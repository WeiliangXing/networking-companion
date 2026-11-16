import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampAvatar,enableAvatarDrag} from '../public/avatar-drag.js';
test('drag bounds keep avatar and controls inside the visible phone viewport',()=>{
 const r={width:112,height:184},v={width:390,height:740};
 assert.deepEqual(clampAvatar(900,900,r,v,36),{x:270,y:548});
 assert.deepEqual(clampAvatar(-50,-50,r,v,36),{x:8,y:44});
 assert.deepEqual(clampAvatar(100,900,r,{...v,height:400,offsetTop:100},36),{x:100,y:308});
});
test('dragging is enabled only with a panel, and closing restores normal positioning',()=>{
 const listeners={},classes=new Set(),attrs={},style={removeProperty(k){delete this[k]}},handle={addEventListener(k,f){listeners[k]=f},setAttribute(k,v){attrs[k]=v},removeAttribute(k){delete attrs[k]},setPointerCapture(){}};
 const widget={style,getBoundingClientRect(){return{left:parseFloat(style.left)||8,top:parseFloat(style.top)||500,width:112,height:184}}};
 let refresh;const Original=globalThis.MutationObserver;
 globalThis.MutationObserver=class{constructor(fn){refresh=fn}observe(){}};
 try{
 const doc={querySelector:()=>widget,body:{classList:{contains:k=>classes.has(k)}},getElementById:id=>id==='avatarStage'?handle:{hidden:true}};
 enableAvatarDrag(doc,{innerWidth:390,innerHeight:740,addEventListener(){}});
 const event=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
 listeners.pointerdown(event(10,510));listeners.pointermove(event(200,200));assert.equal(style.left,undefined);
 classes.add('workspace-open');refresh();assert.equal(handle.tabIndex,0);
 listeners.pointerdown(event(10,510));listeners.pointermove(event(200,200));assert.equal(style.left,'198px');assert.equal(style.top,'190px');listeners.pointerup(event(200,200));
 classes.clear();refresh();assert.equal(style.left,undefined);assert.equal(style.top,undefined);assert.equal(handle.tabIndex,-1);
 }finally{globalThis.MutationObserver=Original}
});
