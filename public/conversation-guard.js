const normalized=s=>(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function soundsLikeEcho(text,reference){
 const a=normalized(text),b=normalized(reference);if(!a||!b)return false;
 const words=a.split(' ');
 if(words.length>=4&&b.includes(a))return true;
 if(words.length===1&&a.length>=8&&/[\u3400-\u9fff]/u.test(a)&&b.includes(a))return true;
 return false;
}
export function intentionalInterruption(text,durationMs,reference){
 const clean=normalized(text);if(!clean||soundsLikeEcho(text,reference))return false;
 if(/^(stop|wait|hold on|pause|yes|no|yes please|no thanks|停|等一下|等等|好的|不用|可以)$/u.test(clean))return durationMs>=450;
 const meaningful=clean.split(' ').length>=2||(/[\u3400-\u9fff]/u.test(clean)&&clean.length>=4);
 return durationMs>=600&&meaningful;
}
// VAD still finds turns, but only this policy may cancel an answer or request another.
export class ConversationGuard {
 constructor(){this.speakingInput=false;this.toolsPending=false;this.generating=false;this.playing=false;this.requested=false;this.pending=false;this.responseId=null;this.assistant='';this.lastAssistant='';this.lastStop=-Infinity;this.turns=new Map();}
 get busy(){return this.toolsPending||this.generating||this.playing||this.requested;}
 handle(e,now=performance.now()){
  const actions=[];
  const send=a=>actions.push(a);
  const flush=()=>{if(this.pending&&!this.speakingInput&&!this.toolsPending&&!this.generating&&!this.requested&&!this.playing){this.pending=false;this.requested=true;send({type:'response.create'});}};
  const accept=t=>{
   if(t.accepted||t.rejected)return;t.accepted=true;
   if(t.protected){
    if(this.generating)send({type:'response.cancel',response_id:this.responseId});
    if(this.playing){send({type:'output_audio_buffer.clear'});this.playing=false;}
    send({type:'diagnostic',name:'confirmedInterruptions'});
   }
   this.pending=true;
   if(t.text)send({type:'remember',text:t.text});
   flush();
  };
  const process=t=>{
   if(!t.committed||!t.stopped||t.accepted||t.rejected)return;
   if(!t.protected){accept(t);return;}
   if(t.text===undefined)return;
   if(intentionalInterruption(t.text,t.duration,[t.reference,this.assistant,this.lastAssistant].filter(Boolean).join(' '))){accept(t);}
   else{t.rejected=true;send({type:'conversation.item.delete',item_id:t.id});send({type:'diagnostic',name:'ignoredDisturbances'});}
  };
  if(e.type==='response.created'){this.generating=true;this.requested=false;this.responseId=e.response?.id;this.assistant='';}
  if(e.type==='response.output_audio_transcript.delta')this.assistant+=e.delta||'';
  if(e.type==='response.output_audio_transcript.done'){this.assistant=e.transcript||this.assistant;this.lastAssistant=this.assistant;}
  if(e.type==='response.done'){
   if(!this.responseId||e.response?.id===this.responseId){this.generating=false;this.requested=false;}
   if(e.response?.status==='failed'){this.generating=false;this.requested=false;this.toolsPending=false;if(this.playing)send({type:'output_audio_buffer.clear'});this.playing=false;}
   if(e.response?.status_details?.error?.code)send({type:'diagnostic',name:'lastResponseError',value:e.response.status_details.error.code});
   send({type:'diagnostic',name:'lastResponseStatus',value:e.response?.status||'unknown'});
   if(e.response?.status_details?.reason)send({type:'diagnostic',name:'lastResponseReason',value:e.response.status_details.reason});
   flush();
  }
  if(e.type==='output_audio_buffer.started')this.playing=true;
  if(['output_audio_buffer.stopped','output_audio_buffer.cleared'].includes(e.type)){this.playing=false;this.lastStop=now;flush();}
  if(e.type==='input_audio_buffer.speech_started'){
   this.speakingInput=true;
   this.turns.set(e.item_id,{id:e.item_id,start:e.audio_start_ms||0,protected:this.playing||(this.generating&&!!this.assistant)||now-this.lastStop<350,reference:this.assistant||this.lastAssistant});
   if(this.turns.size>24)this.turns.delete(this.turns.keys().next().value);
  }
  if(['input_audio_buffer.speech_stopped','input_audio_buffer.committed','conversation.item.input_audio_transcription.completed','conversation.item.input_audio_transcription.failed'].includes(e.type)){
   let t=this.turns.get(e.item_id);
   if(!t){t={id:e.item_id,start:0,protected:this.playing||(this.generating&&!!this.assistant),reference:this.assistant||this.lastAssistant};this.turns.set(e.item_id,t);}
   if(e.type==='input_audio_buffer.speech_stopped'){this.speakingInput=false;t.stopped=true;t.duration=Math.max(0,(e.audio_end_ms||0)-t.start);}
   if(e.type==='input_audio_buffer.committed')t.committed=true;
   if(e.type==='conversation.item.input_audio_transcription.completed'){t.text=e.transcript||'';if(t.accepted)send({type:'remember',text:t.text});}
   if(e.type==='conversation.item.input_audio_transcription.failed')t.text='';
   process(t);if(t.rejected)flush();
  }
  if(e.type==='tools.complete')flush();
  return actions;
 }
}
