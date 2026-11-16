import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {recall} from '../src/memory.js';
import worker from '../src/worker.js';
import {personalTools,tools} from '../src/profile.js';
function database(){const sql=new DatabaseSync(':memory:');for(const name of ['0001','0002','0004'])sql.exec(fs.readFileSync(`migrations/${name}.sql`,'utf8'));return {prepare(q){let values=[];const stmt=sql.prepare(q);const result={bind(...v){values=v;return result},async first(){return stmt.get(...values)},async all(){return{results:stmt.all(...values)}},async run(){return{meta:{changes:stmt.run(...values).changes}}}};return result}};}
const env=db=>({DB:db,PUBLIC_DEMO:'true',SESSION_SECRET:'test-only'});
async function post(db,path,data){return worker.fetch(new Request('https://companion.test/api/owner/'+path,{method:'POST',headers:{Origin:'https://companion.test','X-Networking-App':'1'},body:JSON.stringify(data)}),env(db));}
test('only requested notes persist and can be retrieved in another request',async()=>{
 const db=database();assert.equal((await post(db,'note',{text:'Do not save this'})).status,400);
 assert.equal((await post(db,'note',{text:'Remember robot data collection',save_requested:true})).status,200);
 const response=await post(db,'recall',{kind:'notes',query:'robot'});const data=await response.json();assert.equal(data.notes.length,1);assert.equal(data.notes[0].text,'Remember robot data collection');
 assert.equal((await recall(db,{kind:'notes',query:'%'})).notes.length,0);
});
test('later chats can find saved people and read the exact recipient; empty sessions are excluded',async()=>{
 const db=database();
 await db.prepare('INSERT INTO guests(id,created_at,status,profile) VALUES(?,?,?,?)').bind('alex-1','2026-10-30T12:00:00Z','ended',JSON.stringify({name:'Alex',company:'Example Robotics',email:'alex@example.com',summary:'Discussed data collection'})).run();
 await db.prepare('INSERT INTO guests(id,created_at) VALUES(?,?)').bind('empty','2026-10-30T13:00:00Z').run();
 const list=await (await post(db,'recall',{kind:'people'})).json();assert.equal(list.people.length,1);
 const read=await (await post(db,'recall',{kind:'person',id:list.people[0].id})).json();assert.equal(read.person.profile.email,'alex@example.com');assert.equal(read.person.profile.summary,'Discussed data collection');
 assert.ok(personalTools.some(x=>x.name==='recall_memory'));assert.ok(!tools.some(x=>x.name==='recall_memory'));
});

test('owner canvas contact saves without guest mode and repeated saves update one record',async()=>{
 const db=database(),id=crypto.randomUUID();
 assert.equal((await post(db,'contact',{id,name:'Sam',email:'sam@example.com'})).status,200);
 assert.equal((await post(db,'contact',{id,name:'Sam',email:'correct@example.com'})).status,200);
 const saved=await recall(db,{kind:'people'});assert.equal(saved.people.length,1);
 const full=await recall(db,{kind:'person',id});assert.equal(full.person.profile.email,'correct@example.com');
 assert.equal((await post(db,'contact',{id,name:'Sam',email:'bad'})).status,400);
});
