import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {personalTools,tools,instructions} from '../src/profile.js';
test('company tools retain networking and contacts without a recording tool',()=>{
 assert.ok(personalTools.some(t=>t.name==='start_networking'));
 assert.ok(tools.some(t=>t.name==='open_contact_form'));
 assert.ok(![...tools,...personalTools].some(t=>/meeting/.test(t.name)));
 assert.match(instructions,/AI teaching and consulting/);
});
test('retired meeting endpoints return 404 without database or AI access',async()=>{
 for(const suffix of ['', '/voice', '/analyze']){
 const req=new Request('https://example.com/api/owner/meeting'+suffix,{method:'POST',headers:{Origin:'https://example.com','X-Networking-App':'1'},body:'{}'});
 const response=await worker.fetch(req,{PUBLIC_DEMO:'true',SESSION_SECRET:'test-only'});
 assert.equal(response.status,404);
 }
});

test('hosted company demo can be embedded only by our own app',async()=>{
 const env={ASSETS:{fetch:async()=>new Response('<html>Demo</html>')}};
 const demo=await worker.fetch(new Request('https://example.com/business/'),env);
 const app=await worker.fetch(new Request('https://example.com/'),env);
 assert.match(demo.headers.get('Content-Security-Policy'),/frame-ancestors 'self'/);
 assert.match(app.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 assert.ok(tools.some(t=>t.name==='open_company_website'));
 assert.match(instructions,/William and Joanna/);
});
