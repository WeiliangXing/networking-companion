import test from 'node:test';
import assert from 'node:assert/strict';
import {ConversationGuard,intentionalInterruption} from '../public/conversation-guard.js';
test('short guest replies can interrupt but echoed or empty input cannot',()=>{
 assert.equal(intentionalInterruption('yes',500,''),true);
 assert.equal(intentionalInterruption('I have a question',700,''),true);
 assert.equal(intentionalInterruption('we help businesses save time',1500,'we help businesses save time'),false);
 assert.equal(intentionalInterruption('',1200,''),false);
});
test('tool continuation waits until the guest has finished speaking',()=>{
 const g=new ConversationGuard();g.toolsPending=true;g.pending=true;
 g.handle({type:'input_audio_buffer.speech_started',item_id:'u',audio_start_ms:0},1000);
 g.toolsPending=false;assert.equal(g.handle({type:'tools.complete'},1100).length,0);
 g.handle({type:'input_audio_buffer.speech_stopped',item_id:'u',audio_end_ms:800},1800);
 assert.ok(g.handle({type:'input_audio_buffer.committed',item_id:'u'},1801).some(a=>a.type==='response.create'));
});
test('confirmed short interruption clears playback',()=>{
 const g=new ConversationGuard();g.handle({type:'output_audio_buffer.started'},1000);
 g.handle({type:'input_audio_buffer.speech_started',item_id:'u',audio_start_ms:0},1100);
 g.handle({type:'input_audio_buffer.speech_stopped',item_id:'u',audio_end_ms:500},1600);
 g.handle({type:'input_audio_buffer.committed',item_id:'u'},1601);
 const actions=g.handle({type:'conversation.item.input_audio_transcription.completed',item_id:'u',transcript:'no thanks'},1602);
 assert.ok(actions.some(a=>a.type==='output_audio_buffer.clear'));
});
