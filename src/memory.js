const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function recall(db,d){
 const query=typeof d.query==='string'?d.query.trim().slice(0,300):'';
 const pattern='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
 const offset=Number.isInteger(d.offset)&&d.offset>=0?Math.min(d.offset,10000):0;
 if(d.kind==='notes'){
  const rows=(await db.prepare("SELECT id,text,created_at FROM notes WHERE text LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 51 OFFSET ?").bind(pattern,offset).all()).results;
  return {notes:rows.slice(0,50),next_offset:rows.length>50?offset+50:null};
 }
 if(d.kind==='person'){
  const row=await db.prepare('SELECT id,created_at,event,profile,next_action,due_date FROM guests WHERE id=?').bind(typeof d.id==='string'?d.id:'').first();
  if(!row)fail('Saved person not found',404);
  return {person:{...row,profile:JSON.parse(row.profile)}};
 }
 if(d.kind!=='people')fail('Unknown memory category');
 const rows=(await db.prepare("SELECT id,created_at,event,profile FROM guests WHERE profile!='{}' AND profile LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 51 OFFSET ?").bind(pattern,offset).all()).results;
 return {people:rows.slice(0,50).map(row=>({id:row.id,created_at:row.created_at,event:row.event,...JSON.parse(row.profile)})),next_offset:rows.length>50?offset+50:null};
}
