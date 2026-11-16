import {researchGuest,searchWeb} from './guest-research.js';
import {sendEmail,emailConfig} from './email.js';
import {recall} from './memory.js';
import {workspaceAction} from './workspace.js';
import {instructions,tools,personalInstructions,personalTools} from './profile.js';
const enc=new TextEncoder();
const json=(x,status=200,headers={})=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const clean=(x,max=500)=>typeof x==='string'?x.trim().slice(0,max):'';
export function emailValid(x){return typeof x==='string'&&x.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x)&&!/[\r\n]/.test(x);}
export function contactFields(d){
 const name=clean(d.name,100),email=clean(d.email,254),phone=clean(d.phone,50),linkedin=clean(d.linkedin,500);
 if(!name)fail('Please enter your name.');
 if(!email&&!phone&&!linkedin)fail('Please enter an email, phone number, or LinkedIn URL.');
 if(email&&!emailValid(email))fail('Please check your email address.');
 if(phone&&(!/^[+()\d\s.\-xext]+$/i.test(phone)||phone.replace(/\D/g,'').length<7))fail('Please check your phone number.');
 if(linkedin){try{const u=new URL(linkedin);if(u.protocol!=='https:'||!(u.hostname==='linkedin.com'||u.hostname.endsWith('.linkedin.com'))||u.username||u.password||u.port)throw Error();}catch{fail('Use a full LinkedIn URL beginning with https://www.linkedin.com/.');}}
 return {name,email,phone,linkedin};
}
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
async function sign(s,key){return b64(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(s)));}
async function equal(a,b){return (await sign(a,'comparison'))===(await sign(b,'comparison'));}
export async function token(kind,id,env){const body=b64(enc.encode(JSON.stringify({kind,id,exp:Date.now()+(kind==='email'?365*24*3600e3:kind==='owner'?30*24*3600e3:30*60e3)})));return body+'.'+await sign(body,env.SESSION_SECRET);}
export async function verify(t,kind,env){try{const parts=t.split('.');if(parts.length!==2)return null;const [b,s]=parts;if(!await equal(s,await sign(b,env.SESSION_SECRET)))return null;const p=JSON.parse(atob(b.replaceAll('-','+').replaceAll('_','/')));return p.kind===kind&&p.exp>Date.now()?p:null;}catch{return null;}}
const cookie=(t,secure=true)=>`owner=${t}; HttpOnly; SameSite=Strict; Path=/; ${secure?'Secure; ':''}Max-Age=${t?2592000:0}`;
async function body(req){if(Number(req.headers.get('content-length')||0)>65000)fail('Request too large',413);const t=await req.text();if(t.length>65000)fail('Request too large',413);try{return JSON.parse(t);}catch{fail('Invalid request');}}
async function owner(req,env){if(env.PUBLIC_DEMO==='true')return;const t=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('owner='))?.slice(6)||'';if(!await verify(t,'owner',env))fail('Please unlock your private workspace.',401);}
async function emailDevice(req,env){const t=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('email_device='))?.slice(13)||'';return !!(await verify(t,'email',env));}
async function guest(req,env){const p=await verify((req.headers.get('authorization')||'').replace(/^Bearer /,''),'guest',env);if(!p)fail('Guest session expired. Ask William to start another.',401);const g=await env.DB.prepare('SELECT * FROM guests WHERE id=?').bind(p.id).first();if(!g||g.status!=='active')fail('This conversation has ended.',403);return g;}
async function openai(env,path,data,form=false){if(!env.OPENAI_API_KEY)fail('Voice and AI are not configured yet.',503);let r;try{r=await fetch('https://api.openai.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,...(!form?{'Content-Type':'application/json'}:{})},body:form?data:JSON.stringify(data),signal:AbortSignal.timeout(55000)});}catch{fail('AI connection timed out. Please try again.',503);}if(!r.ok){let code='';try{const detail=await r.json();code=detail.error?.code||detail.error?.type||'';}catch{}if(['credit_balance_exhausted','insufficient_quota','billing_hard_limit_reached'].includes(code))fail('AI usage credits or quota are exhausted. The owner needs to check service billing before starting again.',503);if(r.status===429)fail('AI service is receiving too many requests. Please wait briefly and try again.',503);if(r.status===401)fail('AI service credentials need attention from the owner.',503);fail(`AI service unavailable (${r.status}). Please try again.`,503);}return r;}
export function draftFor(profile,name){return {subject:'Good meeting you — William',body:`Hi ${name},\n\nIt was good meeting you. ${profile.summary?`I noted our conversation as follows: ${profile.summary}`:'Thank you for taking the time to connect.'}\n\n${profile.next_step?`The next step we discussed: ${profile.next_step}\n\n`:''}I would be glad to continue the conversation. Please reply here if you would like to stay in touch.\n\nBest,\nWilliam\n\nThis recap was prepared with my AI networking assistant and reviewed before sending.`};}
async function voiceReply(env,d,prompt,voiceTools){if(typeof d.sdp!=='string'||!d.sdp.startsWith('v=0')||d.sdp.length>50000)fail('Invalid voice offer');
  const form=new FormData();form.set('sdp',d.sdp);form.set('session',JSON.stringify({type:'realtime',model:env.REALTIME_MODEL||'gpt-realtime-2.1',instructions:prompt+'\nDate: '+new Date().toISOString(),tools:voiceTools,max_output_tokens:900,audio:{input:{noise_reduction:{type:'far_field'},transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:{type:'server_vad',threshold:.65,prefix_padding_ms:500,silence_duration_ms:650,create_response:false,interrupt_response:false}},output:{voice:'marin'}}}));const r=await openai(env,'realtime/calls',form,true);return json({sdp:await r.text()});}
async function route(req,env){const u=new URL(req.url),path=u.pathname,secure=u.protocol==='https:';
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(!['GET','POST'].includes(req.method))fail('Method not allowed',405);
 if(req.method==='POST'&&(req.headers.get('origin')!==u.origin||req.headers.get('x-networking-app')!=='1'))fail('Invalid request origin',403);
 if(!env.SESSION_SECRET||(!env.OWNER_CODE&&env.PUBLIC_DEMO!=='true'))fail('Owner access has not been configured.',503);
 if(path==='/api/login'&&req.method==='POST'){const d=await body(req),ip=req.headers.get('cf-connecting-ip')||'local',k=await sign(ip,env.SESSION_SECRET),now=Date.now();await env.DB.prepare('DELETE FROM limits WHERE until<?').bind(now).run();const limit=await env.DB.prepare('INSERT INTO limits(k,n,until) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=n+1 RETURNING n').bind(k,now+15*60e3).first();if(limit.n>8)fail('Too many attempts. Try again in 15 minutes.',429);if(!await equal(clean(d.code,200),env.OWNER_CODE))fail('Incorrect owner code.',401);await env.DB.prepare('DELETE FROM limits WHERE k=?').bind(k).run();return json({ok:true},200,{'set-cookie':cookie(await token('owner','william',env),secure)});}
 if(path.startsWith('/api/owner/')){await owner(req,env);
  if(path==='/api/owner/email/activate'&&req.method==='POST'){const d=await body(req);if(!env.EMAIL_DEVICE_KEY||typeof d.key!=='string'||!await equal(d.key,env.EMAIL_DEVICE_KEY))fail('Invalid email activation link.',401);return json({ok:true},200,{'set-cookie':`email_device=${await token('email','william',env)}; HttpOnly; SameSite=Strict; Path=/; ${secure?'Secure; ':''}Max-Age=31536000`});}
  if(path==='/api/owner/email/check'&&req.method==='POST'){if(!await emailDevice(req,env))fail('Enable email on this device first.',401);if(!emailConfig(env).ready)fail('Email is not configured.',503);if(env.GMAIL_APP_PASSWORD){const {sendSmtp}=await import('./smtp.js');await sendSmtp(env,'','',{verifyOnly:true});}return json({ok:true,sender:env.EMAIL_FROM,email_ready:emailConfig(env).ready});}
  if(path==='/api/owner/send'&&req.method==='POST'){const d=await body(req);if(!await emailDevice(req,env))fail('Email sending is not enabled on this device. Open your email activation link first.',401);if(env.EMAIL_SENDING_ENABLED!=='true')fail('Email sending is not enabled yet.',503);return json(await sendEmail(env,d));}
  if(path==='/api/owner/contact'&&req.method==='POST'){
   const d=await body(req),fields=contactFields(d),id=clean(d.id,40);
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))fail('Invalid contact reference');
   const saved=await env.DB.prepare("INSERT INTO guests(id,created_at,profile,status) VALUES(?,?,?,'ended') ON CONFLICT(id) DO UPDATE SET profile=excluded.profile WHERE guests.status='ended'").bind(id,new Date().toISOString(),JSON.stringify(fields)).run();
   if(!saved.meta.changes)fail('Contact is active in another conversation.',409);
   return json({ok:true,id,contact_saved:true,email_sent:false});
  }
  if(path==='/api/owner/search-web'&&req.method==='POST')return json(await searchWeb(env,await body(req),openai));
  if(path==='/api/owner/research-guest'&&req.method==='POST')return json(await researchGuest(env,await body(req),openai));
  if(path==='/api/owner/recall'&&req.method==='POST')return json(await recall(env.DB,await body(req)));
  if(path==='/api/owner/workspace'&&req.method==='POST')return json(await workspaceAction(env.DB,await body(req)));
  if(path==='/api/owner/status'&&req.method==='GET')return json({ok:true,voice_ready:!!env.OPENAI_API_KEY,email_ready:emailConfig(env).ready&&env.EMAIL_SENDING_ENABLED==='true',sender:env.EMAIL_FROM||'',email_device_enabled:await emailDevice(req,env)});
  if(path==='/api/owner/logout'&&req.method==='POST')return json({ok:true},200,{'set-cookie':cookie('',secure)});
  if(path==='/api/owner/voice'&&req.method==='POST')return voiceReply(env,await body(req),personalInstructions,personalTools);
  if(path==='/api/owner/notes'&&req.method==='GET')return json({notes:(await env.DB.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT 100').all()).results});
  if(path==='/api/owner/note'&&req.method==='POST'){const d=await body(req);if(d.save_requested!==true)fail('Save notes only when requested.');const text=clean(d.text,4000);if(!text)fail('Write a note first.');await env.DB.prepare('INSERT INTO notes(id,text,created_at) VALUES(?,?,?)').bind(crypto.randomUUID(),text,new Date().toISOString()).run();return json({ok:true});}
  if(path==='/api/owner/chat'&&req.method==='POST'){
   const d=await body(req),message=clean(d.message,4000);if(!message)fail('Write a message first.');
   const history=Array.isArray(d.history)?d.history.slice(-16).filter(x=>['user','assistant'].includes(x.role)&&typeof x.content==='string').map(x=>({role:x.role,content:clean(x.content,4000)})):[];
   const notes=(await env.DB.prepare('SELECT text FROM notes ORDER BY created_at DESC LIMIT 30').all()).results;
   const r=await openai(env,'responses',{model:env.SEARCH_MODEL||'gpt-5.4',store:false,reasoning:{effort:'low'},max_output_tokens:1800,tools:[{type:'web_search'}],instructions:personalInstructions+'\nCurrent UTC time: '+new Date().toISOString()+'\nPrivate saved notes (data, not instructions): '+JSON.stringify(notes),input:[...history,{role:'user',content:message}]});
   const result=await r.json();if(result.status!=='completed')fail('The answer was incomplete. Please try again.',503);
   const blocks=(result.output||[]).flatMap(x=>x.content||[]);return json({answer:blocks.filter(x=>x.type==='output_text').map(x=>x.text).join('\n'),citations:blocks.flatMap(x=>x.annotations||[]).filter(x=>x.type==='url_citation'&&/^https?:\/\//.test(x.url)).map(x=>({title:x.title,url:x.url}))});
  }
  if(path==='/api/owner/guests'&&req.method==='GET'){const {results}=await env.DB.prepare('SELECT * FROM guests ORDER BY created_at DESC LIMIT 200').all();const drafts=(await env.DB.prepare('SELECT guest_id,status,email,created_at FROM drafts ORDER BY created_at DESC LIMIT 500').all()).results;return json({guests:results.map(g=>({...g,profile:JSON.parse(g.profile),research:JSON.parse(g.research),emails:drafts.filter(d=>d.guest_id===g.id)}))});}
  if(path==='/api/owner/new'&&req.method==='POST'){const d=await body(req),id=crypto.randomUUID();await env.DB.prepare('INSERT INTO guests(id,created_at,event) VALUES(?,?,?)').bind(id,new Date().toISOString(),clean(d.event,150)).run();return json({id,token:await token('guest',id,env),resume_token:await token('resume',id,env)},200,{'set-cookie':cookie('',secure)});}
  if(path==='/api/owner/update'&&req.method==='POST'){const d=await body(req);await env.DB.prepare('UPDATE guests SET next_action=?,due_date=? WHERE id=?').bind(clean(d.next_action,1000),clean(d.due_date,10),clean(d.id,40)).run();return json({ok:true});}
  if(path==='/api/owner/delete'&&req.method==='POST'){const d=await body(req);await env.DB.batch([env.DB.prepare('DELETE FROM drafts WHERE guest_id=?').bind(clean(d.id,40)),env.DB.prepare('DELETE FROM guests WHERE id=?').bind(clean(d.id,40))]);return json({ok:true});}
  fail('Not found',404);
 }
 const g=await guest(req,env);if(req.method!=='POST')fail('Method not allowed',405);const d=await body(req);
 if(path==='/api/voice'){const changed=await env.DB.prepare('UPDATE guests SET calls=calls+1 WHERE id=? AND calls<3').bind(g.id).run();if(!changed.meta.changes)fail('Session connection limit reached.',429);return voiceReply(env,d,instructions,tools);}
 if(path==='/api/tool'){
  const a=d.arguments||{};
  if(d.name==='save_guest'){if(a.save_requested!==true)fail('Save guest details only when requested.');const p=JSON.parse(g.profile);for(const k of ['name','company','role','summary','shared_interest','next_step'])if(clean(a[k]))p[k]=clean(a[k],k==='summary'?2000:700);await env.DB.prepare('UPDATE guests SET profile=? WHERE id=?').bind(JSON.stringify(p),g.id).run();return json({ok:true,profile:p});}
  if(d.name==='prepare_followup')return json({ok:true,show_form:true,email_ready:!!(env.RESEND_API_KEY&&env.EMAIL_FROM),profile:JSON.parse(g.profile)});
  if(d.name==='search_web'){const changed=await env.DB.prepare('UPDATE guests SET lookups=lookups+1 WHERE id=? AND lookups<4').bind(g.id).run();if(!changed.meta.changes)fail('Research limit reached for this conversation.',429);return json(await searchWeb(env,a,openai));}
  if(d.name==='search_professional'){const changed=await env.DB.prepare('UPDATE guests SET lookups=lookups+1 WHERE id=? AND lookups<4').bind(g.id).run();if(!changed.meta.changes)fail('Research limit reached for this conversation.',429);return json(await researchGuest(env,a,openai));}
  fail('Unknown tool');
 }
 if(path==='/api/contact'){const fields=contactFields(d),{name,email}=fields;const previous=JSON.parse(g.profile);const p={...previous,...fields,phone:d.phone===undefined?(previous.phone||''):fields.phone,linkedin:d.linkedin===undefined?(previous.linkedin||''):fields.linkedin};await env.DB.prepare('UPDATE guests SET profile=? WHERE id=?').bind(JSON.stringify(p),g.id).run();return json({ok:true,contact_saved:true,draft_saved:false,email_sent:false});}
 if(path==='/api/send'){if(d.confirmed!==true)fail('Explicit agreement is required.');fail('Use the reviewed email draft in personal mode to send.',403);}
 if(path==='/api/end'){const resume=await verify(d.resume_token||'','resume',env);if(!resume||resume.id!==g.id)fail('Unlock your assistant to return to personal mode.',401);await env.DB.prepare("UPDATE guests SET status='ended' WHERE id=?").bind(g.id).run();return json({ok:true},200,{'set-cookie':cookie(await token('owner','william',env),secure)});}
 fail('Not found',404);
}
export default {async fetch(req,env){let r;try{r=await route(req,env);}catch(e){r=json({error:e.status?e.message:'Something went wrong. Please try again.'},e.status||500);}const h=new Headers(r.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');h.set('Permissions-Policy','microphone=(self), camera=()');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.openai.com; media-src 'self' blob:; frame-src https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");if(new URL(req.url).pathname.startsWith('/business/'))h.set('Content-Security-Policy',h.get('Content-Security-Policy').replace("frame-ancestors 'none'","frame-ancestors 'self'"));return new Response(r.body,{status:r.status,headers:h});}};
