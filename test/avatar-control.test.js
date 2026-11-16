import {createWorkspace} from '../public/workspace.js';
import {ConversationGuard as RealConversationGuard} from '../public/conversation-guard.js';
import {createContactCanvas} from '../public/contact-canvas.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {tools,personalTools} from '../src/profile.js';
const source=fs.readFileSync('public/app.js','utf8').replace(/^import .*;\n/gm,'');
function setup({delayedMic=false,delayedResearch=false,realGuard=false,realWorkspace=false}={}){
 const nodes=new Map();const el=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,addEventListener(){},style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v},showModal(){this.open=true},close(){this.open=false},reset(){}});return nodes.get(id)};
 const calls=[],peers=[],tracks=[],listeners={},workspaceActions=[],sent=[],micRequests=[];let resolveResearch;let micCount=0,resolveMic;
 const makeMedia=()=>{const t={enabled:true,stopped:false,stop(){this.stopped=true}};tracks.push(t);return{getTracks:()=>[t]}};
 class Peer{constructor(){this.channel={readyState:'open',send(e){sent.push(JSON.parse(e));},close(){}};peers.push(this)}addTrack(){}createDataChannel(){return this.channel}async createOffer(){return{sdp:'v=0'}}async setLocalDescription(){}async setRemoteDescription(){this.channel.onopen()}close(){this.closed=true}}
 const sandbox={AbortController,performance,crypto,createContactCanvas,createAudioWave:()=>({prepare(){},attach(){},stop(){}}),createMeeting:()=>({active:false,finishing:false,hide(){},async start(){this.active=true},connected(){}}),enableAvatarDrag(){},createWorkspace:realWorkspace?createWorkspace:()=>({act:async a=>{workspaceActions.push(a);return{item:{id:'draft-test',...a},email_sent:a.action==='send'};},close:async()=>{el('workspacePanel').hidden=true;},hide(){},flush:async()=>{}}),createWebPanel:()=>({open(){return{ok:true}},close(){el('webPanel').hidden=true;},results(){}}),URLSearchParams,location:{hash:'',pathname:'/',search:''},history:{replaceState(){sandbox.location.hash=''}},createAvatar:()=>({update(){},beginResponse(){},appendText(){}}),ConversationGuard:realGuard?RealConversationGuard:class{handle(){return[]}},document:{getElementById:el,body:{classList:{add(){},remove(){}}}},Audio:class{setAttribute(){}pause(){this.paused=true}play(){return Promise.resolve()}},requestAnimationFrame(){},setTimeout(){return 1},clearTimeout(){},window:{addEventListener(name,fn){listeners[name]=fn}},navigator:{mediaDevices:{getUserMedia(options){micRequests.push(options);micCount++;return delayedMic?new Promise(r=>resolveMic=()=>r(makeMedia())):Promise.resolve(makeMedia())}}},RTCPeerConnection:Peer,fetch:async(url,opts)=>{calls.push({url,body:opts.body?JSON.parse(opts.body):null});if(delayedResearch&&url.endsWith('/research-guest'))return new Promise(resolve=>{resolveResearch=data=>resolve({ok:true,json:async()=>data});});let data={ok:true};if(url.endsWith('/voice'))data={sdp:'answer'};if(url.endsWith('/new'))data={token:'guest',resume_token:'resume'};return{ok:true,json:async()=>data}}};vm.runInNewContext(source,sandbox);
 return{el,calls,peers,tracks,listeners,workspaceActions,sent,micRequests,resolveResearch:data=>resolveResearch(data),location:sandbox.location,micCount:()=>micCount,resolve:()=>resolveMic(),tap:()=>el('conversationControl').onclick()};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('initial load is silent, first tap starts, second tap releases mic and peer',async()=>{const a=setup();await flush();assert.equal(a.micCount(),0);await a.tap();assert.equal(a.micCount(),1);assert.equal(a.el('conversationControl').attrs['aria-pressed'],'true');await a.tap();assert.equal(a.tracks[0].stopped,true);assert.equal(a.peers[0].closed,true);assert.equal(a.el('conversationControl').attrs['aria-pressed'],'false');});
test('tap while permission is pending cancels the eventual microphone stream',async()=>{const a=setup({delayedMic:true});const first=a.tap();await flush();await a.tap();a.resolve();await first;assert.equal(a.tracks[0].stopped,true);assert.equal(a.peers.length,0);});
test('model tool starts a clean guest session; tap ends it without opening personal voice',async()=>{const a=setup();await a.tap();a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'start_networking',arguments:'{}',call_id:'x'}]}})});await flush();await flush();assert.equal(a.peers[0].closed,true);assert.equal(a.peers.length,2);assert.equal(a.micCount(),1);assert.ok(a.calls.some(x=>x.url==='/api/voice'));await a.tap();await flush();assert.ok(a.calls.some(x=>x.url==='/api/end'&&x.body.resume_token==='resume'));assert.equal(a.peers.length,2);assert.equal(a.tracks[0].stopped,true);});
test('guest has no voice-driven exit tool, personal has semantic start tool',()=>{assert.ok(personalTools.some(x=>x.name==='start_networking'));assert.ok(!tools.some(x=>x.name==='end_networking'));});

test('contact canvas keeps capture active and saves optional phone without sending',async()=>{const a=setup();await a.tap();a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'start_networking',arguments:'{}',call_id:'x'}]}})});await flush();await flush();a.peers[1].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'open_contact_form',arguments:'{}',call_id:'form'}]}})});await flush();assert.equal(a.el('contactDialog').hidden,false);assert.equal(a.tracks[0].enabled,true);a.el('contactName').value='Test Guest';a.el('contactPhone').value='617-555-0100';await a.el('contactForm').onsubmit({preventDefault(){}});await flush();assert.equal(a.el('contactDialog').hidden,true);assert.equal(a.tracks[0].enabled,true);assert.ok(a.calls.some(x=>x.url==='/api/contact'&&x.body.phone==='617-555-0100'));assert.ok(!a.calls.some(x=>x.url==='/api/send'));});

test('public prototype does not call login or access-check endpoints',async()=>{const a=setup();await flush();await a.tap();assert.ok(!a.calls.some(x=>x.url==='/api/login'||x.url==='/api/owner/status'));assert.equal(a.micCount(),1);});

test('busy cue follows connecting, thinking, speaking and stop',async()=>{
 const a=setup({delayedMic:true});const first=a.tap();await flush();
 assert.equal(a.el('activity').hidden,false);assert.equal(a.el('activityText').textContent,'Connecting…');
 a.resolve();await first;
 const emit=e=>a.peers[0].channel.onmessage({data:JSON.stringify(e)});
 emit({type:'response.created'});assert.equal(a.el('activityText').textContent,'Thinking…');assert.equal(a.el('activity').hidden,false);
 emit({type:'output_audio_buffer.started'});assert.equal(a.el('activity').hidden,true);
 emit({type:'response.created'});await a.tap();assert.equal(a.el('activity').hidden,true);assert.equal(a.el('avatarStage').attrs['data-busy'],'false');
});


test('leave contact works immediately in owner mode without starting a networking session',async()=>{
 const a=setup();await a.tap();a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'open_contact_form',arguments:'{}',call_id:'contact'}]}})});await flush();
 assert.equal(a.el('contactDialog').hidden,false);assert.equal(a.tracks[0].enabled,true);assert.equal(a.peers.length,1);
 assert.ok(personalTools.some(t=>t.name==='open_contact_form'));assert.ok(personalTools.some(t=>t.name==='contact_canvas'));
 a.el('contactName').value='Test Guest';a.el('contactEmail').value='guest@example.com';await a.el('contactForm').onsubmit({preventDefault(){}});
 assert.ok(a.calls.some(c=>c.url==='/api/owner/contact'&&c.body.email==='guest@example.com'));assert.ok(!a.calls.some(c=>c.url==='/api/owner/new'));
});

test('close panel hides every panel and keeps the conversation active',async()=>{
 const a=setup();await a.tap();for(const id of ['webPanel','workspacePanel','contactDialog'])a.el(id).hidden=false;
 a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'close_panel',arguments:'{}',call_id:'close'}]}})});await flush();
 for(const id of ['webPanel','workspacePanel','contactDialog'])assert.equal(a.el(id).hidden,true);
 assert.equal(a.tracks[0].stopped,false);assert.equal(a.el('conversationControl').attrs['aria-pressed'],'true');
});
test('guest can send only its current follow-up with explicit confirmation',async()=>{
 const a=setup();await a.tap();const emit=(peer,name,args)=>peer.channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name,arguments:JSON.stringify(args),call_id:name}]}})});
 emit(a.peers[0],'start_networking',{});await flush();await flush();
 emit(a.peers[1],'open_contact_form',{});await flush();a.el('contactName').value='Guest';a.el('contactEmail').value='guest@example.com';await a.el('contactForm').onsubmit({preventDefault(){}});
 emit(a.peers[1],'edit_followup',{action:'send',revision:1});await flush();assert.equal(a.workspaceActions.filter(a=>a.action==='send').length,0);
 emit(a.peers[1],'edit_followup',{action:'send',revision:1,confirmed:true});await flush();const send=a.workspaceActions.find(a=>a.action==='send');assert.equal(send.id,'draft-test');assert.equal(send.confirmed,true);
});

const researchResult={title:'Example Company',answer:'Verified business facts. Possible fit: inquiry drafts.',citations:[{title:'Official site',url:'https://example.com'}],at:'2026-10-30T15:00:00Z'};
test('background research returns immediately and shows findings without triggering a spoken interruption',async()=>{
 const a=setup({delayedResearch:true});await a.tap();a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'search_professional',arguments:JSON.stringify({name:'',company:'Example Company',context:'Test'}),call_id:'research'}]}})});await flush();
 assert.ok(a.sent.some(e=>e.item?.type==='function_call_output'&&JSON.parse(e.item.output).status==='searching'));assert.equal(a.tracks[0].enabled,true);assert.equal(a.workspaceActions.length,0);
 const before=a.sent.filter(e=>e.type==='response.create').length;a.resolveResearch(researchResult);await flush();await flush();
 assert.equal(a.workspaceActions.length,0);assert.equal(a.sent.filter(e=>e.type==='response.create').length,before);
});
test('late research results cannot reopen a canvas after Stop',async()=>{
 const a=setup({delayedResearch:true});await a.tap();a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'search_professional',arguments:JSON.stringify({company:'Example'}),call_id:'research'}]}})});await flush();await a.tap();a.resolveResearch(researchResult);await flush();assert.equal(a.workspaceActions.length,0);
});

test('general company search also returns immediately and requests a conversational follow-up before results',async()=>{
 const a=setup({delayedResearch:true,realGuard:true});await a.tap();
 a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name:'research',arguments:JSON.stringify({query:'Wilson Farm in Lexington'}),call_id:'general'}]}})});await flush();
 assert.ok(a.sent.some(e=>e.item?.type==='function_call_output'&&JSON.parse(e.item.output).status==='searching'));
 assert.ok(a.sent.some(e=>e.type==='response.create'&&e.response?.instructions?.includes('Respond aloud now')&&e.response.tool_choice==='none'));
 assert.ok(a.sent.some(e=>e.type==='response.create'&&e.response?.instructions?.includes('Briefly introduce the visible workflow')));
 assert.ok(!a.calls.some(c=>c.url==='/api/owner/chat'));assert.equal(a.workspaceActions.length,0);
 a.resolveResearch(researchResult);await flush();await flush();assert.equal(a.workspaceActions.length,0);
});

test('guest can display fresh service-fit bullet points without research, saving, or email',async()=>{
 const a=setup();await a.tap();const emit=(peer,name,args)=>peer.channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name,arguments:JSON.stringify(args),call_id:name}]}})});
 emit(a.peers[0],'start_networking',{});await flush();await flush();
 const content='• Inquiry replies: explore approved answer templates.\n• Staff teaching: a focused workshop on repetitive tasks.';
 emit(a.peers[1],'show_analysis',{title:'Potential service fit',content});await flush();
 const card=a.workspaceActions.find(x=>x.kind==='analysis');assert.equal(card.content,content);assert.equal(card.title,'Potential service fit');
 assert.ok(!a.calls.some(x=>x.url.includes('research')||x.url.includes('workspace')||x.url.includes('send')));
 for(const list of [tools,personalTools])assert.ok(list.some(t=>t.name==='show_analysis'));
});


test('deferred spoken continuation and another user turn work while research is unresolved',async()=>{
 const a=setup({delayedResearch:true,realGuard:true});await a.tap();
 const emit=e=>a.peers[0].channel.onmessage({data:JSON.stringify(e)});
 emit({type:'response.created',response:{id:'search'}});
 emit({type:'output_audio_buffer.started'});
 const before=a.sent.filter(e=>e.type==='response.create').length;
 emit({type:'response.done',response:{id:'search',output:[{type:'function_call',name:'research',arguments:JSON.stringify({query:'Wilson Farm Lexington'}),call_id:'search'}]}});await flush();
 assert.equal(a.sent.filter(e=>e.type==='response.create').length,before);
 emit({type:'output_audio_buffer.stopped'});
 const followup=a.sent.filter(e=>e.type==='response.create').at(-1);
 assert.equal(followup.response.tool_choice,'none');assert.match(followup.response.instructions,/Respond aloud now/);
 emit({type:'response.created',response:{id:'followup'}});
 emit({type:'response.done',response:{id:'followup',output:[]}});
 const count=a.sent.filter(e=>e.type==='response.create').length;
 emit({type:'input_audio_buffer.speech_started',item_id:'user-next',audio_start_ms:0});
 emit({type:'input_audio_buffer.speech_stopped',item_id:'user-next',audio_end_ms:2200});
 emit({type:'input_audio_buffer.committed',item_id:'user-next'});
 emit({type:'conversation.item.input_audio_transcription.completed',item_id:'user-next',transcript:'We spend time answering customer questions'});
 assert.equal(a.sent.filter(e=>e.type==='response.create').length,count+1);
 assert.equal(a.workspaceActions.length,0);assert.equal(a.tracks[0].enabled,true);
 a.resolveResearch(researchResult);await flush();await flush();
 assert.equal(a.workspaceActions.length,0);
});


test('real canvas opens queued analysis after research and supports immediate show_analysis',async()=>{
 const a=setup({delayedResearch:true,realWorkspace:true});await a.tap();
 const emit=(name,args)=>a.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name,arguments:JSON.stringify(args),call_id:name}]}})});
 emit('search_professional',{company:'Example'});await flush();
 emit('show_guest_research',{});await flush();assert.equal(a.el('workspacePanel').hidden,true);
 a.resolveResearch(researchResult);await flush();await flush();
 assert.equal(a.el('workspacePanel').hidden,false);assert.equal(a.el('analysisFields').hidden,false);assert.equal(a.el('emailFields').hidden,true);
 assert.equal(a.el('work_content').value,researchResult.answer);assert.equal(a.el('webPanel').hidden,true);
 emit('close_panel',{});await flush();assert.equal(a.el('workspacePanel').hidden,true);
 emit('show_analysis',{title:'Potential fit',content:'• Prepare customer reply drafts.'});await flush();await flush();
 assert.equal(a.el('workspacePanel').hidden,false);assert.equal(a.el('work_content').value,'• Prepare customer reply drafts.');
});

test('everyday search is available in both modes and returns without opening research canvas',async()=>{
 for(const list of [tools,personalTools])assert.ok(list.some(t=>t.name==='search_web'));
 const a=setup({realGuard:true});await a.tap();
 const emit=(name,args)=>a.peers.at(-1).channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name,arguments:JSON.stringify(args),call_id:name}]}})});
 emit('search_web',{query:'Chinese food in Lexington MA'});await flush();
 assert.ok(a.calls.some(c=>c.url==='/api/owner/search-web'));assert.equal(a.workspaceActions.length,0);
 emit('start_networking',{});await flush();await flush();
 emit('search_web',{query:'Chinese food in Lexington MA'});await flush();
 assert.ok(a.calls.some(c=>c.url==='/api/tool'&&c.body.name==='search_web'));assert.equal(a.workspaceActions.length,0);
});

test('team workflow reflects pending and ready research, opens suggestions on tap, and clears on Stop',async()=>{
 const a=setup({delayedResearch:true,realWorkspace:true});await a.tap();
 const emit=e=>a.peers[0].channel.onmessage({data:JSON.stringify(e)});
 assert.equal(a.el('teamProcess').hidden,true);
 emit({type:'response.done',response:{output:[{type:'function_call',name:'search_professional',arguments:'{"company":"Example"}',call_id:'team'}]}});await flush();
 assert.equal(a.el('teamProcess').hidden,false);assert.equal(a.el('teamResearch').attrs['data-state'],'working');assert.equal(a.el('teamAdvisor').disabled,true);
 emit({type:'output_audio_buffer.started'});assert.equal(a.el('teamHostStatus').textContent,'Speaking');assert.equal(a.el('teamHost').attrs['data-state'],'speaking');
 a.resolveResearch(researchResult);await flush();await flush();
 assert.equal(a.el('teamAdvisor').disabled,false);assert.equal(a.el('teamAdvisor').attrs['data-state'],'ready');assert.equal(a.el('workspacePanel').hidden,true);
 a.el('teamAdvisor').onclick();await flush();await flush();assert.equal(a.el('workspacePanel').hidden,false);assert.equal(a.el('work_content').value,researchResult.answer);
 await a.tap();assert.equal(a.el('teamProcess').hidden,true);
});

test('explicit voice dismissal sleeps in both modes, releases mic and permits restarting',async()=>{
 for(const guest of [false,true]){
 const a=setup({delayedResearch:true});await a.tap();
 const emit=(name,args)=>a.peers.at(-1).channel.onmessage({data:JSON.stringify({type:'response.done',response:{output:[{type:'function_call',name,arguments:JSON.stringify(args),call_id:name}]}})});
 if(guest){emit('start_networking',{});await flush();await flush();}
 emit('sleep_assistant',{explicit_dismissal:false});await flush();assert.equal(a.el('conversationControl').attrs['aria-pressed'],'true');
 const peer=a.peers.at(-1),before=a.sent.filter(e=>e.type==='response.create').length;
 emit('sleep_assistant',{explicit_dismissal:true});await flush();await flush();
 assert.equal(a.el('conversationControl').textContent,'Start');assert.equal(peer.closed,true);assert.equal(a.tracks[0].stopped,true);assert.equal(a.el('teamHostStatus').textContent,'Sleeping');
 assert.equal(a.sent.filter(e=>e.type==='response.create').length,before);
 if(guest)assert.ok(a.calls.some(c=>c.url==='/api/end'));
 await a.tap();assert.equal(a.el('conversationControl').textContent,'Stop');assert.equal(a.micCount(),2);
 }
});


test('explicit mic selection reaches capture and input check releases its temporary stream',async()=>{
 const a=setup();a.el('micSelect').value='receiver-123';a.el('micSelect').onchange();await a.tap();
 assert.equal(a.micRequests[0].audio.deviceId.exact,'receiver-123');assert.equal(a.micRequests[0].audio.echoCancellation,true);
 await a.el('micCheck').onclick();assert.equal(a.peers[0].closed,true);assert.equal(a.tracks.at(-1).stopped,true);assert.equal(a.el('conversationControl').textContent,'Start');
 await a.tap();assert.equal(a.micRequests.at(-1).audio.deviceId.exact,'receiver-123');
});


test('local mic test uses chosen device without creating a voice session and closes its track',async()=>{
 const a=setup();a.el('micSelect').value='usb';a.el('micSelect').onchange();a.el('micRaw').checked=true;
 await a.el('micTest').onclick();assert.equal(a.micRequests.at(-1).audio.deviceId.exact,'usb');assert.equal(a.micRequests.at(-1).audio.noiseSuppression,false);assert.equal(a.micRequests.at(-1).audio.echoCancellation,true);
 assert.equal(a.peers.length,0);assert.equal(a.calls.length,0);assert.equal(a.tracks[0].stopped,false);
 a.el('micSettingsClose').onclick();assert.equal(a.tracks[0].stopped,true);
});
test('closing settings while mic test permission is pending releases late capture',async()=>{
 const a=setup({delayedMic:true});const pending=a.el('micTest').onclick();a.el('micSettingsClose').onclick();a.resolve();await pending;assert.equal(a.tracks[0].stopped,true);assert.equal(a.peers.length,0);
});
