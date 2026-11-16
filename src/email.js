const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const encode=s=>btoa(String.fromCharCode(...new TextEncoder().encode(s)));
export function emailConfig(env){
 const provider=env.GMAIL_APP_PASSWORD?'gmail_smtp':env.GMAIL_REFRESH_TOKEN&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET?'gmail_api':env.RESEND_API_KEY?'resend':null;
 return {ready:!!(provider&&env.EMAIL_FROM),sender:env.EMAIL_FROM||'',provider};
}
export function messageFields(d){
 if(d.confirmed!==true)fail('Ask William to send this exact draft first.');
 const {recipient,subject,body}=d;
 if(typeof recipient!=='string'||recipient.length>254||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)||/[\r\n]/.test(recipient))fail('Enter one valid recipient email.');
 if(typeof subject!=='string'||!subject.trim()||subject.length>300||/[\r\n]/.test(subject))fail('Enter a valid email subject.');
 if(typeof body!=='string'||!body.trim()||body.length>20000)fail('Enter an email message (up to 20,000 characters).');
 return {recipient,subject,body};
}
export function mimeMessage(from,m,id){
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from))fail('Sender is not configured correctly.',503);
 return [`From: ${from}`,`To: ${m.recipient}`,`Subject: =?UTF-8?B?${encode(m.subject)}?=`,`Message-ID: <${id}@companion.local>`,`Date: ${new Date().toUTCString()}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encode(m.body).match(/.{1,76}/g).join('\r\n')].join('\r\n');
}
async function deliver(env,m,id,fetcher){
 const {provider,sender}=emailConfig(env);
 if(provider==='gmail_smtp'){
  const {sendSmtp}=await import('./smtp.js');return sendSmtp(env,mimeMessage(sender,m,id),m.recipient);
 }
 if(provider==='gmail_api'){
  const auth=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
  if(!auth.ok)throw Object.assign(Error('Reconnect Gmail before sending.'),{definite:true});
  const token=await auth.json();
  const raw=encode(mimeMessage(sender,m,id)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const r=await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Object.assign(Error('Gmail rejected the send. Nothing was confirmed sent.'),{definite:true});
  return (await r.json()).id||id;
 }
 const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:sender,to:[m.recipient],subject:m.subject,text:m.body}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Object.assign(Error('Email provider rejected the send.'),{definite:true});
 return (await r.json()).id||id;
}
export async function sendEmail(env,d,fetcher=fetch){
 const m=messageFields(d),config=emailConfig(env);
 if(!config.ready)fail('Email is not connected yet. Your draft has not been sent.',503);
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([config.sender,m.recipient,m.subject,m.body]))))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const claim=await env.DB.prepare("INSERT OR IGNORE INTO email_deliveries(id,fingerprint,recipient,status,created_at,updated_at) VALUES(?,?,?,'sending',?,?)").bind(id,fingerprint,m.recipient,now,now).run();
 if(!claim.meta.changes){
  const previous=await env.DB.prepare('SELECT id,status FROM email_deliveries WHERE fingerprint=?').bind(fingerprint).first();
  if(previous.status==='sent')return {ok:true,email_sent:true,already_sent:true,delivery_id:previous.id,message:'Already accepted for delivery; no duplicate sent.'};
  fail(previous.status==='failed'?'This send was rejected earlier. Check the email connection before trying again.':'A send is already pending or its outcome is uncertain. Check Sent mail before retrying.',409);
 }
 try{
  const providerId=await deliver(env,m,id,fetcher);
  await env.DB.prepare("UPDATE email_deliveries SET status='sent',provider_id=?,updated_at=? WHERE id=?").bind(providerId,new Date().toISOString(),id).run();
  return {ok:true,email_sent:true,delivery_id:id,message:'Email accepted for delivery. Inbox arrival is not verified.'};
 }catch(e){
  await env.DB.prepare('UPDATE email_deliveries SET status=?,updated_at=? WHERE id=?').bind(e.definite?'failed':'unknown',new Date().toISOString(),id).run();
  fail(e.definite?e.message:'Send outcome uncertain. Check Sent mail before retrying; do not send again automatically.',502);
 }
}
