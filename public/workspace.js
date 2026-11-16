export function createWorkspace(doc,request,onOpen,sendRequest){
 const el=id=>doc.getElementById(id),keys=['recipient','subject','body','title','content'];
 const field=k=>el('work_'+k);
 // Cards stay in memory until Save is explicitly requested. No autosave on close/Stop.
 const cards=new Map();let current=null,sequence=0,queue=Promise.resolve();
 const status=text=>{el('workspaceStatus').textContent=text;};
 const values=()=>Object.fromEntries(keys.map(k=>[k,field(k).value||'']));
 const result=item=>({item:{...item.data},saved:!item.dirty&&!!item.savedId,email_sent:item.sent===true});
 function render(item){current=item;for(const k of keys)field(k).value=item.data[k]||'';el('emailFields').hidden=item.data.kind!=='email';el('analysisFields').hidden=item.data.kind!=='analysis';el('workspaceTitle').textContent=item.data.kind==='analysis'?'Analysis':'Email draft';el('workspacePanel').hidden=false;doc.body.classList.add('workspace-open');status(item.sent?'Sent · Accepted for delivery':item.dirty?'Not saved · Say “save this” or tap Save':'Saved');el('workspaceSend').hidden=item.data.kind!=='email';el('workspaceSend').disabled=item.sent===true;onOpen();}
 function run(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}
 for(const k of keys)field(k).oninput=()=>{if(!current)return;Object.assign(current.data,values());current.data.revision++;current.dirty=true;current.sent=false;el('workspaceSend').disabled=false;status('Not saved · Say “save this” or tap Save');};
 function hide(){el('workspacePanel').hidden=true;doc.body.classList.remove('workspace-open');}
 async function close(){hide();}
 async function save(item){
  if(!item.dirty&&item.savedId)return result(item);
  const at=item.data.revision,data={...item.data};status('Saving…');
  try{
   const r=await request({...data,action:item.savedId?'update':'create',id:item.savedId||'',revision:item.savedRevision,save_requested:true});
   item.savedId=r.item.id;item.savedRevision=r.item.revision;
   // Keep the client revision independent of the persisted revision for concurrent typing.
   item.dirty=item.data.revision!==at;
   cards.set(r.item.id,item);
   if(current===item)status(item.dirty?'New edits not saved':'Saved');
   return {...result(item),saved:true,saved_id:item.savedId,unsaved_changes:item.dirty};
  }catch(e){if(current===item)status('Not saved — '+e.message);throw e;}
 }
 async function act(args){return run(async()=>{
  if(args.action==='list')return request({action:'list'});
  if(args.action==='create'){
   const data={id:'local-'+(++sequence),kind:args.kind==='analysis'?'analysis':'email',revision:1};
   for(const k of keys)data[k]=typeof args[k]==='string'?args[k]:'';
   const item={data,dirty:true,savedId:null,savedRevision:null};cards.set(data.id,item);render(item);return result(item);
  }
  const id=args.id||current?.data.id;let item=cards.get(id);
  if(!item&&args.action==='read'){
   const r=await request({action:'read',id});item={data:{...r.item},dirty:false,savedId:r.item.id,savedRevision:r.item.revision};cards.set(id,item);
  }
  if(!item)throw Error('Read/open the item first, or create one.');
  if(args.action==='read'){render(item);return result(item);}
  if(args.action==='save')return save(item);
  if(args.action==='send'){
   if(args.confirmed!==true)throw Error('Ask William to send this exact draft first.');
   if(item.data.kind!=='email')throw Error('Only email drafts can be sent.');
   if(args.revision!==item.data.revision)throw Error('The draft changed. Read the latest version before sending.');
   if(!sendRequest)throw Error('Email is not connected.');
   const at=item.data.revision,snapshot={...item.data};status('Sending…');el('workspaceSend').disabled=true;
   try{const r=await sendRequest({...snapshot,confirmed:true});if(item.data.revision===at)item.sent=r.email_sent===true;if(current===item)status(item.sent?'Sent · Accepted for delivery':'Previous version sent · Current edits not sent');return r;}
   catch(e){if(current===item)status('Not confirmed sent — '+e.message);throw e;}
   finally{el('workspaceSend').disabled=item.sent===true;}
  }
  if(args.action!=='update')throw Error('Unknown workspace action.');
  if(args.revision!==item.data.revision)throw Error('The card changed. Read its latest contents before editing.');
  for(const k of keys)if(Object.hasOwn(args,k))item.data[k]=args[k];
  item.data.revision++;item.dirty=true;item.sent=false;render(item);return result(item);
 });}
 el('workspaceClose').onclick=close;
 el('workspaceSend').onclick=()=>{if(current)act({action:'send',confirmed:true,revision:current.data.revision}).catch(()=>{});};
 el('workspaceSave').onclick=()=>{if(current)act({action:'save'}).catch(()=>{});};
 return {act,close,hide};
}
