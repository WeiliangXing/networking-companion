import {test} from 'node:test';
import assert from 'node:assert/strict';
import {websiteUrl,createWebPanel} from '../public/web-panel.js';
test('rejects executable, credentialed, local and own-origin URLs',()=>{for(const url of ['javascript:alert(1)','data:text/html,x','http://example.com','https://u:p@example.com','https://127.0.0.1','https://localhost','https://device.local','https://[::1]','https://companion.example/path'])assert.throws(()=>websiteUrl(url,'https://companion.example'));assert.equal(websiteUrl('https://example.com'),'https://example.com/');});
function setup(){const nodes=new Map(),classes=new Set();const node=()=>({hidden:true,children:[],append(x){this.children.push(x)},replaceChildren(){this.children=[]},removeAttribute(k){delete this[k]}});const doc={body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:()=>node()};return{doc,panel:createWebPanel(doc,'https://companion.example'),classes};}
test('source selection opens preview with fallback, close removes remote frame and results',()=>{const{doc,panel,classes}=setup();panel.results({citations:[{url:'javascript:x',title:'bad'},{url:'https://example.com',title:'Example source'}]});assert.equal(doc.getElementById('webResults').children.length,1);doc.getElementById('webResults').children[0].onclick();assert.equal(doc.getElementById('webFrame').src,'https://example.com/');assert.equal(doc.getElementById('webLink').href,'https://example.com/');assert.equal(doc.getElementById('webHint').hidden,false);assert.ok(classes.has('web-open'));panel.close();assert.equal(doc.getElementById('webFrame').src,undefined);assert.equal(doc.getElementById('webResults').children.length,0);assert.ok(!classes.has('web-open'));});
test('opening a page never reports verified loading',()=>{const{panel}=setup();assert.equal(panel.open('https://example.com').verified_loaded,false);});

test('deduplicates repeated citations and clears choices when a website opens',()=>{
 const {doc,panel}=setup();
 panel.results({citations:[
  {url:'https://example.com/page',title:'Example'},
  {url:'https://example.com/page?utm_source=search#section',title:'Example'},
  {url:'https://other.example/page',title:'Example'}
 ]});
 const list=doc.getElementById('webResults');
 assert.equal(list.children.length,2);
 assert.notEqual(list.children[0].textContent,list.children[1].textContent);
 panel.open('https://example.com/page','Example');
 assert.equal(list.children.length,0);
 assert.equal(doc.getElementById('webFrame').hidden,false);
});
test('preserves different meaningful URL queries',()=>{
 const {doc,panel}=setup();
 panel.results({citations:[{url:'https://example.com/?q=a'},{url:'https://example.com/?q=b'}]});
 assert.equal(doc.getElementById('webResults').children.length,2);
});

test('only the approved company demo is allowed on our own origin',()=>{
 assert.equal(websiteUrl('https://companion.example/business/','https://companion.example'),'https://companion.example/business/');
 for(const path of ['/','/api/owner/status','/business/../','/business/other'])assert.throws(()=>websiteUrl('https://companion.example'+path,'https://companion.example'));
 const {panel,doc}=setup();panel.open('https://companion.example/business/');assert.equal(doc.getElementById('webHint').hidden,true);
});

test('company page controller scrolls authored sections and refuses external pages',async()=>{
 const {panel,doc}=setup();panel.open('https://companion.example/business/');let scrolled='';
 const frame=doc.getElementById('webFrame');frame.contentWindow={location:{pathname:'/business/',href:frame.src},scrollY:0,innerHeight:800,scrollTo({top}){this.scrollY=top;}};
 frame.contentDocument={querySelectorAll:()=>[],readyState:'complete',documentElement:{scrollHeight:3000},getElementById:id=>({innerText:'Services '+id,scrollIntoView(){scrolled=id;frame.contentWindow.scrollY=900;}})};
 const r=await panel.companyAction({action:'section',section:'help'});assert.equal(scrolled,'help');assert.equal(r.scrollY,900);assert.ok(r.sections.some(s=>s.id==='help'));
 await panel.companyAction({action:'scroll',direction:'top'});assert.equal(frame.contentWindow.scrollY,0);
 panel.open('https://example.com/');await assert.rejects(panel.companyAction({action:'read'}),/only for our company/);
});

test('company example click activates the observed button and returns the changed content',async()=>{
 const {panel,doc}=setup();panel.open('https://companion.example/business/');let selected=false,example='Old example';
 const button={dataset:{task:'Replies'},textContent:'Reply to a customer',click(){selected=true;example='Thanks for reaching out.';},getAttribute(){return String(selected);},scrollIntoView(){}};
 const frame=doc.getElementById('webFrame');frame.contentWindow={location:{pathname:'/business/',href:frame.src},scrollY:0};frame.contentDocument={readyState:'complete',querySelectorAll:()=>[button],getElementById:id=>({innerText:id==='example'?example:'Section'})};
 const before=await panel.companyAction({action:'read'});assert.equal(before.controls[0].control_id,'Replies');
 const after=await panel.companyAction({action:'click',control_id:before.controls[0].control_id});assert.equal(after.controls[0].selected,true);assert.equal(after.example,'Thanks for reaching out.');
 await assert.rejects(panel.companyAction({action:'click',control_id:'nonexistent'}),/available control_id/);
});
