import * as THREE from './vendor/three.module.js';
import {GestureDirector} from './gesture-director.js';
export function createAvatar(host){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(0,1.15,8.2);camera.lookAt(0,1.1,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x667466,2.4));
 const light=new THREE.DirectionalLight(0xfff4df,3.5);light.position.set(-3,5,5);scene.add(light);
 const rim=new THREE.DirectionalLight(0xb9e8e0,2);rim.position.set(4,2,-3);scene.add(rim);
 const shell=new THREE.MeshStandardMaterial({color:0xb9d7ca,roughness:.29,metalness:.18});
 const dark=new THREE.MeshStandardMaterial({color:0x25483f,roughness:.42,metalness:.3});
 const glow=new THREE.MeshStandardMaterial({color:0xe1f5ae,emissive:0x95bb55,emissiveIntensity:.65});
 function ball(parent,x,y,z,sx,sy,sz,mat=shell){const m=new THREE.Mesh(new THREE.SphereGeometry(1,40,28),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
 function capsule(parent,r,len,x,y,z,mat=shell){const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,8,20),mat);m.position.set(x,y,z);parent.add(m);return m;}
 const root=new THREE.Group();scene.add(root);
 ball(root,0,.35,0,.64,.78,.4);ball(root,0,-.3,0,.53,.2,.34,dark);capsule(root,.16,.18,0,1.06,0,dark);
 ball(root,0,.57,.385,.16,.16,.04,dark);ball(root,0,.57,.428,.112,.112,.025,glow);
 const head=new THREE.Group();head.position.y=1.72;root.add(head);ball(head,0,0,0,.88,.73,.57);
 ball(head,-.89,0,0,.12,.23,.2,dark);ball(head,.89,0,0,.12,.23,.2,dark);
 capsule(head,.035,.2,0,.81,0,dark);ball(head,0,.99,0,.09,.09,.09,glow);
 const faceCanvas=document.createElement('canvas');faceCanvas.width=512;faceCanvas.height=384;const pen=faceCanvas.getContext('2d');
 const texture=new THREE.CanvasTexture(faceCanvas);texture.colorSpace=THREE.SRGBColorSpace;
 const faceMat=new THREE.MeshBasicMaterial({map:texture});ball(head,0,-.015,.365,.75,.56,.22,faceMat);
 // A front-facing patch avoids spherical texture distortion around the eyes.
 const face=new THREE.Mesh(new THREE.PlaneGeometry(1.22,.88),new THREE.MeshBasicMaterial({map:texture,transparent:true}));face.position.set(0,-.015,.591);head.add(face);
 // The underlying visor is solid; the facial graphics are drawn on the patch.
 head.children.find(m=>m.material===faceMat).material=dark;
 function arm(side){const shoulder=new THREE.Group();shoulder.position.set(side*.65,.78,0);root.add(shoulder);ball(shoulder,0,0,0,.19,.19,.19,dark);capsule(shoulder,.145,.35,0,-.29,0);const elbow=new THREE.Group();elbow.position.y=-.58;shoulder.add(elbow);ball(elbow,0,0,0,.14,.14,.14,dark);capsule(elbow,.13,.28,0,-.24,0);const hand=new THREE.Group();hand.position.y=-.5;elbow.add(hand);ball(hand,0,0,0,.17,.19,.105);for(let i=0;i<3;i++)capsule(hand,.035,.12,(i-1)*.09,-.19,0);capsule(hand,.05,.1,side*.17,-.01,0).rotation.z=side*.6;return {shoulder,elbow,hand};}
 const left=arm(-1),right=arm(1);
 const gaze=new THREE.Group();gaze.position.copy(head.position);head.position.set(0,0,0);root.add(gaze);gaze.add(head);
 head.name='Head';for(const [arm,prefix] of [[left,'Left'],[right,'Right']]){arm.shoulder.name=prefix+'Shoulder';arm.elbow.name=prefix+'Elbow';arm.hand.name=prefix+'Hand';}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const director=new GestureDirector(root,{reduced});let nextBlink=2.5,blinkUntil=0,smile=.5,browLift=0,gesture='rest';
 const modeColors={idle:new THREE.Color('#718776'),personal:new THREE.Color('#43d9c5'),networking:new THREE.Color('#ffbe60')};
 let mode='idle',modeSince=0,personal=0,networking=0,active=0;
 const limbPose=new Map();
 for(const arm of [left,right])for(const joint of ['shoulder','elbow','hand'])limbPose.set(arm[joint],new THREE.Vector3());
 let current='idle',changed=0,level=0,last=0,lookX=0,lookY=0;
 host.addEventListener('pointermove',e=>{const r=host.getBoundingClientRect();lookX=((e.clientX-r.left)/r.width-.5)*.25;lookY=((e.clientY-r.top)/r.height-.5)*.12;});host.addEventListener('pointerleave',()=>{lookX=lookY=0;});
 const resize=()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
 function drawFace(t,s,energy){
  pen.clearRect(0,0,512,384);pen.strokeStyle=pen.fillStyle=glow.color.clone().lerp(new THREE.Color('#e5f1d8'),.55).getStyle();pen.lineCap='round';
  if(t>nextBlink){blinkUntil=t+.12;nextBlink=t+3+Math.random()*4;}const blink=!reduced&&t<blinkUntil;const eyeH=blink?4:30+browLift*7;
  for(const x of [151,361]){pen.beginPath();if(mode==='idle'){pen.lineWidth=8;pen.moveTo(x-24,143);pen.quadraticCurveTo(x,159,x+24,143);pen.stroke();}else{pen.ellipse(x,145,17,eyeH,0,0,Math.PI*2);pen.fill();}}
  pen.lineWidth=9;const brow=s==='thinking'?-10:gesture==='curious'?12:browLift*6;
  for(const [x,sign] of [[151,-1],[361,1]]){pen.beginPath();pen.moveTo(x-28,91+sign*brow);pen.quadraticCurveTo(x,80-browLift*5,x+28,91-sign*brow);pen.stroke();}
  pen.beginPath();if(mode==='idle'){pen.moveTo(240,250);pen.quadraticCurveTo(256,254,272,250);pen.stroke();}else if(s==='speaking'&&energy>.025){pen.ellipse(256,255,32+energy*30,8+energy*80,0,0,Math.PI*2);pen.fill();}else{pen.moveTo(210,244);pen.quadraticCurveTo(256,252+smile*30,302,244);pen.stroke();}
  pen.globalAlpha=.25;for(const x of [108,404]){pen.beginPath();pen.ellipse(x,220,24,10,0,0,Math.PI*2);pen.fill();}pen.globalAlpha=1;texture.needsUpdate=true;
 }
 return {beginResponse(){director.beginResponse();},appendText(text){director.appendText(text);},preview(name){director.play(name);},update(phase,energy,time,visualMode=phase==='idle'?'idle':'personal'){
  const t=time/1000,dt=Math.min(.05,(time-last)/1000||.016);last=time;
  if(!modeColors[visualMode])visualMode='idle';
  if(visualMode!==mode){mode=visualMode;modeSince=t;host.dataset.mode=mode;}
  const blend=1-Math.exp(-dt*4);
  personal+=((mode==='personal'?1:0)-personal)*blend;networking+=((mode==='networking'?1:0)-networking)*blend;active+=((mode==='idle'?0:1)-active)*blend;
  glow.color.lerp(modeColors[mode],blend);glow.emissive.copy(glow.color);
  const busy=phase==='connecting'||phase==='thinking';
  glow.emissiveIntensity=.08+active*(busy&&!reduced?.6+.25*Math.sin(t*2.5):.65);
  if(phase!==current){current=phase;changed=t;host.dataset.expression=phase;}
  level+=(Math.min(1,energy*5)-level)*Math.min(1,dt*18);
  gesture=director.update(phase,dt);host.dataset.gesture=gesture;
  const speaking=phase==='speaking',listening=phase==='listening';
  smile+=((gesture==='reassure'?.25:gesture==='curious'?.45:speaking?.85:.6)-smile)*dt*5;
  browLift+=((listening||gesture==='curious'?1:speaking?.45:0)-browLift)*dt*5;
  root.position.y=reduced?0:Math.sin(t*(mode==='idle'?.85:1.7))*(mode==='idle'?.012:.018);root.rotation.y=reduced?0:Math.sin(t*.43)*.035;
  root.rotation.x=-personal*.045;root.position.y+=networking*.055;
  // Mixer owns the pose; subtle gaze and speech energy are additive, not looping arm waves.
  if(!reduced){gaze.rotation.y=mode==='idle'?0:lookX;gaze.rotation.x=(mode==='idle'?.12:lookY)+(speaking?Math.sin(t*3)*level*.07:0);}
  if(!reduced){
   const age=t-modeSince;
   if(mode==='idle'&&age<1.1)gaze.rotation.x+=Math.sin(Math.PI*age/1.1)*.13;
   if(listening)gaze.rotation.z=-.035;else gaze.rotation.z=0;
  }
  // Smooth the mixer's authored speaking poses; settle into a quiet rest otherwise.
  const armBlend=1-Math.exp(-dt*5);
  for(const [arm,sign] of [[left,-1],[right,1]])for(const joint of ['shoulder','elbow','hand']){
   const object=arm[joint],pose=limbPose.get(object);
   let x=0,y=0,z=joint==='shoulder'?sign*(.12+networking*.08):0;
   if(joint==='elbow')x=-.08;
   if(speaking&&!reduced){const strength=joint==='hand'?.55:.85;x=object.rotation.x*strength;y=object.rotation.y*strength;z=object.rotation.z*strength;}
   pose.x+=(x-pose.x)*armBlend;pose.y+=(y-pose.y)*armBlend;pose.z+=(z-pose.z)*armBlend;
   object.rotation.set(pose.x,pose.y,pose.z);
  }
  drawFace(t,phase,level);renderer.render(scene,camera);
 }};
}
