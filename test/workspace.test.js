import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {workspaceAction} from '../src/workspace.js';
import {createWorkspace} from '../public/workspace.js';
function database(){const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('migrations/0004.sql','utf8'));return {prepare(q){let values=[];const stmt=sql.prepare(q);const result={bind(...v){values=v;return result},async first(){return stmt.get(...values)},async all(){return{results:stmt.all(...values)}},async run(){return{meta:{changes:stmt.run(...values).changes}}}};return result}};}
test('email and analysis persist and stale edits cannot overwrite typed changes',async()=>{
 const db=database();let {item}=await workspaceAction(db,{action:'create',save_requested:true,subject:'Hello',body:'Original'});
 const saved=await workspaceAction(db,{action:'update',save_requested:true,id:item.id,revision:1,body:'Typed revision'});
 await assert.rejects(workspaceAction(db,{action:'update',save_requested:true,id:item.id,revision:1,body:'Stale AI revision'}),e=>e.status===409);
 assert.equal((await workspaceAction(db,{action:'read',id:item.id})).item.body,'Typed revision');
 assert.equal(saved.item.revision,2);
 const analysis=await workspaceAction(db,{action:'create',save_requested:true,kind:'analysis',title:'Options',content:'Finding\nSource: https://example.com'});
 assert.equal(analysis.item.kind,'analysis');assert.equal(analysis.item.content,'Finding\nSource: https://example.com');
 assert.equal((await workspaceAction(db,{action:'list'})).items.length,2);
 await assert.rejects(workspaceAction(db,{action:'update',save_requested:true,id:item.id,revision:2,recipient:'a@example.com\nBcc:x'}));
});
function ui(db){
 const nodes=new Map(),classes=new Set(),calls=[];
 const doc={body:{classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}},getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:true});return nodes.get(id)}};
 return {doc,classes,calls,panel:createWorkspace(doc,d=>{calls.push(d);return workspaceAction(db,d)},()=>{})};
}
test('create, typing, agent update and close never save; explicit save survives a fresh session',async()=>{
 const db=database(),{doc,panel,calls}=ui(db);
 let result=await panel.act({action:'create',kind:'analysis',title:'Plan',content:'First'});
 assert.equal(result.saved,false);assert.equal(calls.length,0);
 const field=doc.getElementById('work_content');field.value='My manual edit';field.oninput();
 result=await panel.act({action:'read'});assert.equal(result.item.content,'My manual edit');
 await assert.rejects(panel.act({action:'update',revision:1,content:'Stale edit'}));
 await panel.act({action:'update',revision:result.item.revision,content:'Revised with manual edit'});
 await panel.close();assert.equal(calls.length,0);
 assert.equal((await workspaceAction(db,{action:'list'})).items.length,0);
 const saved=await panel.act({action:'save'});assert.equal(saved.saved,true);assert.equal(calls.length,1);
 const fresh=ui(db);const list=await fresh.panel.act({action:'list'});assert.equal(list.items.length,1);
 result=await fresh.panel.act({action:'read',id:list.items[0].id});assert.equal(result.item.content,'Revised with manual edit');
 await fresh.panel.act({action:'update',revision:result.item.revision,content:'Unsaved new change'});
 await fresh.panel.close();assert.equal((await workspaceAction(db,{action:'read',id:saved.saved_id})).item.content,'Revised with manual edit');
 await fresh.panel.act({action:'save'});assert.equal((await workspaceAction(db,{action:'read',id:saved.saved_id})).item.content,'Unsaved new change');
});
test('server rejects workspace persistence without save intent',async()=>{
 await assert.rejects(workspaceAction(database(),{action:'create',content:'Do not store'}),e=>e.status===400);
});

test('sending requires fresh revision and sends typed content without silently saving a draft',async()=>{
 const nodes=new Map(),sent=[],requests=[];
 const doc={body:{classList:{add(){},remove(){}}},getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:true});return nodes.get(id)}};
 const panel=createWorkspace(doc,async d=>{requests.push(d);throw Error('Should not save')},()=>{},async d=>{sent.push(d);return{email_sent:true}});
 const draft=await panel.act({action:'create',recipient:'guest@example.com',subject:'Hello',body:'Original'});
 doc.getElementById('work_body').value='Edited by William';doc.getElementById('work_body').oninput();
 await assert.rejects(panel.act({action:'send',confirmed:true,revision:draft.item.revision}),/changed/);
 const latest=await panel.act({action:'read'});await panel.act({action:'send',confirmed:true,revision:latest.item.revision});
 assert.equal(sent.length,1);assert.equal(sent[0].body,'Edited by William');assert.equal(requests.length,0);assert.equal(doc.getElementById('workspaceSend').disabled,true);
});
