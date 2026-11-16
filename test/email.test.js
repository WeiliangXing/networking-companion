import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {sendEmail,mimeMessage,messageFields} from '../src/email.js';
import {smtpSession} from '../src/smtp.js';
function db(){const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('migrations/0005.sql','utf8'));return {prepare(q){let v=[];const s=sql.prepare(q);const p={bind(...x){v=x;return p},async first(){return s.get(...v)},async run(){return{meta:{changes:s.run(...v).changes}}}};return p}};}
const message={confirmed:true,recipient:'guest@example.com',subject:'Good connecting',body:'Thanks for chatting with my AI companion.\nBest,\nWilliam'};
const config=()=>({DB:db(),EMAIL_FROM:'william@example.com',RESEND_API_KEY:'test-only'});
test('email sends the exact reviewed text once and records provider acceptance',async()=>{
 const env=config();let calls=0;const provider=async(url,args)=>{calls++;const sent=JSON.parse(args.body);assert.equal(sent.text,message.body);assert.deepEqual(sent.to,[message.recipient]);return Response.json({id:'provider-1'})};
 const r=await sendEmail(env,message,provider);assert.equal(r.email_sent,true);const repeat=await sendEmail(env,message,provider);assert.equal(repeat.already_sent,true);assert.equal(calls,1);
});
test('unconfirmed, invalid and unconfigured messages never invoke delivery',async()=>{
 let calls=0;const provider=async()=>{calls++;};const env=config();
 await assert.rejects(sendEmail(env,{...message,confirmed:false},provider));
 await assert.rejects(sendEmail(env,{...message,recipient:'a@example.com\r\nBcc:b@example.com'},provider));
 await assert.rejects(sendEmail({...env,RESEND_API_KEY:''},message,provider));assert.equal(calls,0);
});
test('uncertain send cannot be retried automatically',async()=>{
 const env=config();let calls=0;const provider=async()=>{calls++;throw Error('Network lost')};
 await assert.rejects(sendEmail(env,message,provider),/uncertain/);
 await assert.rejects(sendEmail(env,message,provider),e=>e.status===409);assert.equal(calls,1);
});
test('MIME encodes Unicode subject and body without adding headers',()=>{
 const mime=mimeMessage('william@example.com',messageFields({...message,subject:'你好 — William',body:'Hi\n.\nThanks'}),'test-id');
 assert.match(mime,/Subject: =\?UTF-8\?B\?/);assert.match(mime,/Content-Transfer-Encoding: base64/);assert.ok(!mime.includes('\n.\n'));
});
test('SMTP authenticates over supplied socket and only reports success after DATA acceptance',async()=>{
 const encoder=new TextEncoder(),writes=[];let closed=false;
 const replies=['220 ready\r\n','250-host\r\n250 AUTH LOGIN\r\n','334 user\r\n','334 password\r\n','235 authenticated\r\n','250 ok\r\n','250 ok\r\n','354 data\r\n','250 accepted\r\n'];
 const socket={opened:Promise.resolve(),readable:new ReadableStream({start(c){for(const r of replies)c.enqueue(encoder.encode(r));c.close()}}),writable:new WritableStream({write(b){writes.push(new TextDecoder().decode(b))}}),async close(){closed=true}};
 assert.equal(await smtpSession(socket,{EMAIL_FROM:'william@example.com',GMAIL_APP_PASSWORD:'test password'},'test MIME',message.recipient),'gmail-smtp-accepted');assert.ok(closed);assert.equal(writes.at(-1),'test MIME\r\n.\r\n');assert.equal(writes[0],'EHLO companion.local\r\n');
});
