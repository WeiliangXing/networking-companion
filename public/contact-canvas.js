const fields={name:'contactName',email:'contactEmail',phone:'contactPhone',linkedin:'contactLinkedin'};
export function createContactCanvas(doc,save,onOpen,onSaved=async()=>({})){
 const el=id=>doc.getElementById(id);let revision=0,active=false,busy=false;
 const read=()=>({ok:true,open:active,revision,fields:Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,el(id).value||'']))});
 function close(){active=false;revision++;el('contactDialog').hidden=true;doc.body.classList.remove('contact-open');}
 function open(profile={}){if(!active){onOpen();for(const [k,id] of Object.entries(fields))el(id).value=profile[k]||'';revision++;active=true;el('contactDialog').hidden=false;doc.body.classList.add('contact-open');el('contactError').textContent='';}return read();}
 async function act(a){if(a.action==='read')return read();if(a.action==='close'){close();return{ok:true,closed:true};}if(!active)throw Error('Open the contact canvas first.');if(busy)throw Error('Contact save is in progress.');if(a.revision!==revision)throw Error('Contact details changed. Read the canvas again before updating or saving.');
 if(a.action==='update'){for(const [k,id] of Object.entries(fields))if(typeof a[k]==='string')el(id).value=a[k].trim().slice(0,k==='linkedin'?500:k==='email'?254:k==='phone'?50:100);revision++;el('contactError').textContent='Review these details before saving.';return read();}
 if(a.action!=='save')throw Error('Unknown contact action.');if(a.confirmed!==true)throw Error('Confirm the displayed contact details before saving.');
 const current=revision,snapshot=read().fields;busy=true;el('contactSave').disabled=true;
 try{const result=await save(snapshot);let followup={};if(active&&revision===current){el('contactError').textContent='Contact saved. Preparing email draft…';try{followup=await onSaved(snapshot);}catch(e){el('contactError').textContent='Contact saved. Email draft could not open: '+e.message;followup={draft_opened:false,draft_error:e.message};}}return{...result,ok:true,contact_saved:true,email_sent:false,...followup};}finally{busy=false;el('contactSave').disabled=false;}
 }
 for(const id of Object.values(fields))el(id).addEventListener('input',()=>{revision++;el('contactError').textContent='';});
 el('contactCancel').onclick=()=>close();
 el('contactForm').onsubmit=async e=>{e.preventDefault();try{await act({action:'save',revision,confirmed:true});}catch(err){el('contactError').textContent=err.message;}};
 return{open,close,act,read};
}
