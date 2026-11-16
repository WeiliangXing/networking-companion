// Run against local Wrangler with migrated local D1; never production.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='http://localhost:' + (process.env.LOCAL_TEST_PORT || '5203');
const env=Object.fromEntries(fs.readFileSync('.dev.vars','utf8').trim().split('\n').map(l=>{const i=l.indexOf('=');return[l.slice(0,i),JSON.parse(l.slice(i+1))]}));
async function post(path,data,extra={}){const r=await fetch(base+'/api/'+path,{method:'POST',headers:{Origin:base,'X-Networking-App':'1','Content-Type':'application/json',...extra},body:JSON.stringify(data)});return {r,data:await r.json()};}
const login=await post('login',{code:env.OWNER_CODE});assert.equal(login.r.status,200);const cookie=login.r.headers.get('set-cookie').split(';')[0];
const session=await post('owner/new',{}, {cookie});assert.equal(session.r.status,200);assert.ok(session.r.headers.get('set-cookie').includes('Max-Age=0'));const headers={Authorization:'Bearer '+session.data.token};
assert.equal((await post('contact',{name:'Test',linkedin:'https://evil.example'},headers)).r.status,400);
const phone=await post('contact',{name:'Integration Test',phone:'+1 617 555 0100'},headers);assert.equal(phone.r.status,200);assert.equal(phone.data.draft_saved,false);
const contact=await post('contact',{name:'Integration Test',email:'test@example.com'},headers);assert.equal(contact.r.status,200);assert.equal(contact.data.contact_saved,true);
await post('tool',{name:'save_guest',arguments:{save_requested:true,name:'',company:'Test Company',role:'',summary:'Synthetic local test',shared_interest:'',next_step:''}},headers);
const profile=await post('tool',{name:'prepare_followup'},headers);assert.equal(profile.data.profile.email,'test@example.com');assert.equal(profile.data.profile.name,'Integration Test');
assert.equal((await post('send',{id:session.data.id,confirmed:true},headers)).r.status,403);
assert.equal((await post('end',{resume_token:'invalid'},headers)).r.status,401);
const ended=await post('end',{resume_token:session.data.resume_token},headers);assert.equal(ended.r.status,200);assert.ok(ended.r.headers.get('set-cookie').includes('owner='));assert.equal((await post('contact',{name:'Test',email:'test@example.com'},headers)).r.status,403);
await post('owner/delete',{id:session.data.id},{cookie});
console.log('Local integration passed: login, guest handoff, contact persistence, empty-field preservation, disconnected email, ended-session access.');
