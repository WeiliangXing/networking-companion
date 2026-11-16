import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{token,verify,emailValid,draftFor,contactFields} from '../src/worker.js';
const env={SESSION_SECRET:'test-secret-only',OWNER_CODE:'test-owner'};
test('owner and guest tokens cannot cross modes or be modified',async()=>{const t=await token('guest','guest-1',env);assert.equal((await verify(t,'guest',env)).id,'guest-1');assert.equal(await verify(t,'owner',env),null);assert.equal(await verify(t+'x','guest',env),null);assert.equal(await verify(t,'guest',{SESSION_SECRET:'wrong'}),null);});
test('expired tokens are rejected',async()=>{const original=Date.now;Date.now=()=>original()-3600e3;let t;try{t=await token('guest','guest-1',env);}finally{Date.now=original;}assert.equal(await verify(t,'guest',env),null);});
test('guest token cannot read private notes',async()=>{const t=await token('guest','guest-1',env);const r=await worker.fetch(new Request('https://example.com/api/owner/notes',{headers:{Authorization:'Bearer '+t}}),env);assert.equal(r.status,401);});
test('cross-origin writes are blocked before database access',async()=>{const r=await worker.fetch(new Request('https://example.com/api/login',{method:'POST',headers:{Origin:'https://evil.example','X-Networking-App':'1'},body:'{}'}),env);assert.equal(r.status,403);});
test('missing agreement blocks email without invoking provider',async()=>{const t=await token('guest','one',env);const db={prepare:()=>({bind:()=>({first:async()=>({id:'one',status:'active'})})})};const r=await worker.fetch(new Request('https://example.com/api/send',{method:'POST',headers:{Origin:'https://example.com','X-Networking-App':'1',Authorization:'Bearer '+t},body:JSON.stringify({confirmed:false})}),{...env,DB:db});assert.equal(r.status,400);});
test('email rejects header injection and recap avoids invented commitments',()=>{assert.equal(emailValid('x@example.com\r\nBcc: x@evil.com'),false);assert.equal(emailValid('x@example.com'),true);assert.ok(!draftFor({},'Guest').body.includes('next step we discussed'));});

test('contact accepts phone or LinkedIn without email and rejects empty/unsafe details',()=>{assert.equal(contactFields({name:'Guest',phone:'+1 (617) 555-0100'}).email,'');assert.ok(contactFields({name:'Guest',linkedin:'https://www.linkedin.com/in/test'}).linkedin);assert.throws(()=>contactFields({name:'Guest'}));assert.throws(()=>contactFields({name:'Guest',email:'bad'}));assert.throws(()=>contactFields({name:'Guest',linkedin:'https://linkedin.com.evil.example/profile'}));assert.throws(()=>contactFields({name:'Guest',linkedin:'javascript:alert(1)'}));});

test('explicit public prototype setting bypasses owner login',async()=>{const r=await worker.fetch(new Request('https://example.com/api/owner/status'),{SESSION_SECRET:'test',PUBLIC_DEMO:'true'});assert.equal(r.status,200);});

test('public chat does not grant sending; only email-activated devices can reach delivery',async()=>{
 const publicEnv={...env,PUBLIC_DEMO:'true',EMAIL_SENDING_ENABLED:'true'};
 const request=cookie=>new Request('https://example.com/api/owner/send',{method:'POST',headers:{Origin:'https://example.com','X-Networking-App':'1',Cookie:cookie},body:JSON.stringify({confirmed:true,recipient:'guest@example.com',subject:'Hello',body:'Test'})});
 assert.equal((await worker.fetch(request(''),publicEnv)).status,401);
 const ownerToken=await token('owner','william',env);assert.equal((await worker.fetch(request('owner='+ownerToken),publicEnv)).status,401);
 const emailToken=await token('email','william',env);const r=await worker.fetch(request('email_device='+emailToken),publicEnv);assert.equal(r.status,503);assert.match((await r.json()).error,/not connected/);
});
