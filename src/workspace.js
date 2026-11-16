const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function emailPatch(input){
 const result={};
 for(const [key,max] of [['title',300],['content',20000],['recipient',254],['subject',300],['body',20000]])if(Object.hasOwn(input,key)){
  if(typeof input[key]!=='string'||input[key].length>max)fail('Invalid '+key);
  if(!['body','content'].includes(key)&&/[\r\n]/.test(input[key]))fail('Invalid '+key);
  result[key]=input[key];
 }
 return result;
}
export async function workspaceAction(db,d){
 const id=typeof d.id==='string'?d.id:'';
 if(d.action==='list')return {items:(await db.prepare('SELECT id,kind,title,recipient,subject,revision,updated_at FROM workspace_items ORDER BY updated_at DESC LIMIT 50').all()).results};
 if(['create','update'].includes(d.action)&&d.save_requested!==true)fail('Saving requires an explicit Save request.');
 if(d.action==='create'){
  const p=emailPatch(d),id=crypto.randomUUID(),kind=d.kind==='analysis'?'analysis':'email';
  await db.prepare('INSERT INTO workspace_items(id,kind,title,content,recipient,subject,body,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,kind,p.title||'',p.content||'',p.recipient||'',p.subject||'',p.body||'',new Date().toISOString()).run();
  return {item:await db.prepare('SELECT * FROM workspace_items WHERE id=?').bind(id).first(),email_sent:false};
 }
 const item=await db.prepare('SELECT * FROM workspace_items WHERE id=?').bind(id).first();
 if(!item)fail('Draft not found',404);
 if(d.action==='read')return {item,email_sent:false};
 if(d.action!=='update')fail('Unknown workspace action');
 const patch=emailPatch(d);
 if(!Number.isInteger(d.revision))fail('Read the draft before editing it.');
 const next={...item,...patch};
 const changed=await db.prepare('UPDATE workspace_items SET title=?,content=?,recipient=?,subject=?,body=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(next.title,next.content,next.recipient,next.subject,next.body,new Date().toISOString(),id,d.revision).run();
 if(!changed.meta.changes)fail('Draft changed. Read the latest draft before applying your edit.',409);
 return {item:await db.prepare('SELECT * FROM workspace_items WHERE id=?').bind(id).first(),email_sent:false};
}
