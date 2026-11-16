import test from 'node:test';
import assert from 'node:assert/strict';
import {createContactCanvas} from '../public/contact-canvas.js';
function setup(){const nodes=new Map(),saved=[];const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:true,addEventListener(_,f){this.input=f;}});return nodes.get(id);};const doc={getElementById:el,body:{classList:{add(){},remove(){}}}};return{el,saved,canvas:createContactCanvas(doc,async f=>{saved.push(f);return{ok:true};},()=>{})};}
test('spoken updates stay temporary, respect typed corrections, save exact reviewed fields',async()=>{
 const {canvas,el,saved}=setup();const initial=canvas.open();
 const edited=await canvas.act({action:'update',revision:initial.revision,name:'Jo',email:'wrong@example.com'});
 assert.equal(saved.length,0);el('contactEmail').value='correct@example.com';el('contactEmail').input();
 await assert.rejects(canvas.act({action:'update',revision:edited.revision,email:'wrong@example.com'}),/changed/);
 await assert.rejects(canvas.act({action:'save',revision:canvas.read().revision}),/Confirm/);
 await canvas.act({action:'save',revision:canvas.read().revision,confirmed:true});assert.equal(saved[0].email,'correct@example.com');
});
test('closing a contact canvas discards it without saving; reopening starts fresh',async()=>{const{canvas,saved}=setup();const first=canvas.open({name:'Guest'});canvas.close();assert.equal(saved.length,0);await assert.rejects(canvas.act({action:'save',revision:first.revision,confirmed:true}),/Open/);assert.equal(canvas.open().fields.name,'');});

test('voice and button Save open a draft only after persistence succeeds',async()=>{
 for(const viaButton of [false,true]){
  const nodes=new Map(),events=[];const el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',addEventListener(){}});return nodes.get(id);};
  const doc={getElementById:el,body:{classList:{add(){},remove(){}}}};
  const canvas=createContactCanvas(doc,async fields=>{events.push('saved');assert.equal(fields.email,'guest@example.com');return{ok:true};},()=>{},async fields=>{events.push('draft');assert.equal(fields.email,'guest@example.com');return{draft_opened:true};});
  canvas.open({name:'Guest',email:'guest@example.com'});
  if(viaButton)await el('contactForm').onsubmit({preventDefault(){}});else assert.equal((await canvas.act({action:'save',revision:canvas.read().revision,confirmed:true})).draft_opened,true);
  assert.deepEqual(events,['saved','draft']);
 }
});
test('failed contact persistence never opens a draft',async()=>{
 const el=()=>({addEventListener(){}});let opened=false;
 const canvas=createContactCanvas({getElementById:el,body:{classList:{add(){},remove(){}}}},async()=>{throw Error('Save failed');},()=>{},async()=>{opened=true;});
 canvas.open();await assert.rejects(canvas.act({action:'save',revision:canvas.read().revision,confirmed:true}),/Save failed/);assert.equal(opened,false);
});
