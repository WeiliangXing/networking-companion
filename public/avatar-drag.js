export function clampAvatar(x,y,rect,viewport,headroom=0){
 const left=viewport.offsetLeft||0,top=viewport.offsetTop||0,gap=8;
 return {x:Math.max(left+gap,Math.min(x,left+viewport.width-rect.width-gap)),y:Math.max(top+gap+headroom,Math.min(y,top+viewport.height-rect.height-gap))};
}
export function enableAvatarDrag(doc,win){
 const widget=doc.querySelector('main'),handle=doc.getElementById('avatarStage');
 let drag=null,placed=false;
 const active=()=>doc.body.classList.contains('web-open')||doc.body.classList.contains('workspace-open')||doc.body.classList.contains('contact-open');
 const viewport=()=>win.visualViewport||{width:win.innerWidth,height:win.innerHeight};
 function place(x,y){
  const badge=doc.getElementById('activity'),headroom=badge.hidden?0:badge.getBoundingClientRect().height+6;
  const p=clampAvatar(x,y,widget.getBoundingClientRect(),viewport(),headroom);
  widget.style.left=p.x+'px';widget.style.top=p.y+'px';widget.style.bottom='auto';placed=true;
 }
 function finish(e){if(!drag||e.pointerId!==drag.id)return;drag=null;handle.removeAttribute('data-dragging');}
 handle.addEventListener('pointerdown',e=>{
  if(!active()||e.button!==0)return;
  const r=widget.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
  handle.setPointerCapture(e.pointerId);handle.setAttribute('data-dragging','true');e.preventDefault();
 });
 handle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;place(drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);e.preventDefault();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,finish);
 handle.addEventListener('keydown',e=>{
  if(!active())return;const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!delta)return;
  const r=widget.getBoundingClientRect();place(r.left+delta[0],r.top+delta[1]);e.preventDefault();
 });
 function refresh(){
  const enabled=active();handle.tabIndex=enabled?0:-1;
  if(enabled){handle.setAttribute('aria-label','Move avatar. Drag or use arrow keys.');handle.title='Drag to move';}
  else{handle.removeAttribute('aria-label');handle.removeAttribute('title');drag=null;placed=false;handle.removeAttribute('data-dragging');widget.style.removeProperty('left');widget.style.removeProperty('top');widget.style.removeProperty('bottom');}
 }
 function constrain(){if(active()&&placed){const r=widget.getBoundingClientRect();place(r.left,r.top);}}
 new MutationObserver(refresh).observe(doc.body,{attributes:true,attributeFilter:['class']});
 win.addEventListener('resize',constrain);win.visualViewport?.addEventListener('resize',constrain);win.visualViewport?.addEventListener('scroll',constrain);refresh();
}
