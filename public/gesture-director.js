import * as THREE from './vendor/three.module.js';
const REST={Head:[0,0,0],LeftShoulder:[0,0,-.12],RightShoulder:[0,0,.12],LeftElbow:[-.08,0,0],RightElbow:[-.08,0,0],LeftHand:[0,0,0],RightHand:[0,0,0]};
const poses={
 rest:{},
 welcome:{LeftShoulder:[-.35,0,-.72],RightShoulder:[-.35,0,.72],LeftElbow:[-.65,0,0],RightElbow:[-.65,0,0],LeftHand:[0,-.4,-.1],RightHand:[0,.4,.1],Head:[.04,0,0]},
 present:{RightShoulder:[-.45,0,.92],RightElbow:[-.6,0,0],RightHand:[0,.55,.2],Head:[.02,.13,.03]},
 wave:{RightShoulder:[-.15,0,2.3],RightElbow:[-.35,0,0],RightHand:[0,0,.3],Head:[0,-.05,-.07]},
 explain:{LeftShoulder:[-.3,0,-.48],RightShoulder:[-.4,0,.62],LeftElbow:[-.65,0,0],RightElbow:[-.8,0,0],LeftHand:[0,-.3,-.2],RightHand:[0,.3,.2]},
 offerLeft:{LeftShoulder:[-.55,0,-.65],LeftElbow:[-.9,0,0],LeftHand:[0,-.65,-.15],Head:[.02,-.12,-.04]},
 offerRight:{RightShoulder:[-.55,0,.65],RightElbow:[-.9,0,0],RightHand:[0,.65,.15],Head:[.02,.12,.04]},
 emphasize:{RightShoulder:[-.35,0,.36],RightElbow:[-1.2,0,0],RightHand:[0,.3,.15],Head:[.08,0,0]},
 curious:{LeftShoulder:[-.25,0,-.38],RightShoulder:[-.25,0,.38],LeftElbow:[-.8,0,0],RightElbow:[-.8,0,0],LeftHand:[0,-.6,0],RightHand:[0,.6,0],Head:[-.03,0,-.13]},
 reassure:{RightShoulder:[-.65,0,-.12],RightElbow:[-1.1,0,0],RightHand:[0,.3,.15],Head:[.08,0,.07]},
 think:{RightShoulder:[-.7,0,.4],RightElbow:[-1.65,0,0],Head:[-.06,.2,.1]},
 nod:{Head:[.17,0,0]},
 attend:{Head:[.025,-.09,-.08]},
};
export const GESTURES=Object.keys(poses);
export function intentForText(text){
 if(/\b(sorry|frustrating|overwhelm|understand|difficult)\b|抱歉|理解|困难/i.test(text))return 'reassure';
 if(/\b(first|step|important|remember)\b|首先|第一|重要/i.test(text))return 'emphasize';
 if(/[?？]/.test(text))return 'curious';
 if(/\b(for example|such as|for instance)\b|例如|比如/i.test(text))return 'offerRight';
 return null;
}
function clip(name){
 const target={...REST,...poses[name]},rest=name==='rest';
 const duration=rest?1:name==='wave'?2.6:name==='nod'?1.5:3.0;
 const times=[0,.2,.4,.6,.8,1].map(t=>t*duration),tracks=[];
 for(const joint of Object.keys(REST))for(let axis=0;axis<3;axis++){
  const a=REST[joint][axis],b=target[joint][axis];
  const values=[a,b,b,b,b,a];
  if(name==='wave'&&joint==='RightHand'&&axis===2)values.splice(0,6,0,.45,-.45,.45,-.45,0);
  if(name==='nod'&&joint==='Head'&&axis===0)values.splice(0,6,0,.17,-.04,.12,0,0);
  tracks.push(new THREE.NumberKeyframeTrack(`${joint}.rotation[${'xyz'[axis]}]`,times,values,THREE.InterpolateSmooth));
 }
 return new THREE.AnimationClip(name,duration,tracks);
}
// Uses the bundled animation mixer; no inference calls or remote motion service.
export class GestureDirector{
 constructor(root,{random=Math.random,reduced=false}={}){
  this.mixer=new THREE.AnimationMixer(root);this.random=random;this.reduced=reduced;this.actions=new Map(GESTURES.map(n=>[n,this.mixer.clipAction(clip(n))]));this.phase='idle';this.name='rest';this.elapsed=0;this.until=0;this.previous='';this.text='';this.intent=null;this.usedIntent=null;this.expiring=[];this.play('rest');
 }
 beginResponse(){this.text='';this.intent=null;this.usedIntent=null;}
 appendText(text){this.text=(this.text+text).slice(-1500);this.intent=intentForText(this.text);}
 play(name){
  if(!this.actions.has(name))return;
  const next=this.actions.get(name),old=this.action;if(old===next)return;
  // A reused action must not be stopped by an older crossfade cleanup.
  this.expiring=this.expiring.filter(x=>x.action!==next);
  next.reset().setLoop(name==='rest'?THREE.LoopRepeat:THREE.LoopOnce, name==='rest'?Infinity:1);next.clampWhenFinished=true;next.enabled=true;next.setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  if(old){old.crossFadeTo(next,.5,false);this.expiring.push({action:old,at:this.elapsed+.55});}
  this.action=next;this.name=name;this.until=this.elapsed+next.getClip().duration;this.previous=name==='rest'?this.previous:name;
 }
 choose(list){const candidates=list.filter(n=>n!==this.previous);return candidates[Math.floor(this.random()*candidates.length)]||list[0];}
 update(phase,dt){
  this.elapsed+=dt;
  if(phase!==this.phase){const prior=this.phase;this.phase=phase;
   if(phase==='idle'){this.beginResponse();this.play('rest');}
   else if(!this.reduced){this.play(phase==='connecting'&&prior==='idle'?'wave':phase==='thinking'?'think':phase==='listening'?'attend':phase==='speaking'?(this.intent||'explain'):'rest');this.usedIntent=phase==='speaking'?this.intent:null;}
  }
  if(!this.reduced&&this.elapsed>=this.until){
   if(this.name!=='rest'){this.play('rest');this.until=this.elapsed+(phase==='speaking'?.55+this.random()*.8:2.5+this.random()*3);}
   else if(phase==='speaking'){const cue=this.intent&&this.intent!==this.usedIntent?this.intent:null;this.play(cue||this.choose(['explain','offerLeft','offerRight','emphasize','welcome','present','reassure','curious']));this.usedIntent=this.intent;}
   else if(phase==='listening')this.play(this.choose(['attend','nod']));
   else if(phase==='thinking'||phase==='connecting')this.play('think');
  }
  this.mixer.update(dt);
  this.expiring=this.expiring.filter(x=>{if(this.elapsed>=x.at){if(x.action!==this.action)x.action.stop();return false;}return true;});
  return this.name;
 }
}
