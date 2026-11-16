export function websiteUrl(value,ownOrigin=''){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||(u.origin===ownOrigin&&!(u.pathname==='/business/'||u.pathname==='/business/index.html')))throw Error('Use a public HTTPS website address.');
 if(u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||u.hostname.includes(':')||/^\d+(\.\d+){3}$/.test(u.hostname))throw Error('Use a public website, not a local network address.');
 return u.href;
}
export function createWebPanel(doc,origin){
 const el=id=>doc.getElementById(id);
 function close(){el('webPanel').hidden=true;el('webFrame').removeAttribute('src');el('webResults').replaceChildren();el('webLink').removeAttribute('href');doc.body.classList.remove('web-open');}
 function open(url,title='Website'){
  const safe=websiteUrl(url,origin);el('webResults').replaceChildren();el('webPanel').hidden=false;doc.body.classList.add('web-open');el('webTitle').textContent=title||new URL(safe).hostname;el('webLink').href=safe;el('webLink').hidden=false;el('webHint').hidden=new URL(safe).origin===origin;el('webFrame').hidden=false;el('webFrame').src=safe;
  return {ok:true,url:safe,embedded_attempt:true,verified_loaded:false,note:new URL(safe).origin===origin?'Our company demo was requested. Use company_page read to inspect its sections and clickable example controls, then click a returned control_id.':'Requested an embedded third-party website. Cannot confirm loading or control its contents; Open in browser is available.'};
 }
 function results(data){
  const list=el('webResults');list.replaceChildren();let count=0;const seen=new Set();
  for(const item of data.citations||[]){let url;try{url=websiteUrl(item.url,origin);}catch{continue;}const key=new URL(url);key.hash='';for(const name of [...key.searchParams.keys()])if(name.startsWith('utm_')||['gclid','fbclid'].includes(name))key.searchParams.delete(name);key.searchParams.sort();if(seen.has(key.href))continue;seen.add(key.href);const button=doc.createElement('button');button.className='web-result';button.textContent=(item.title||'Website')+' · '+new URL(url).hostname;button.onclick=()=>open(url,item.title);list.append(button);count++;}
  if(!count)return;
  el('webPanel').hidden=false;doc.body.classList.add('web-open');el('webTitle').textContent='Search results';el('webFrame').hidden=true;el('webFrame').removeAttribute('src');el('webLink').hidden=true;el('webHint').hidden=true;
 }
 el('webClose').onclick=close;
 async function companyAction(a){
  const frame=el('webFrame');
  if(el('webPanel').hidden)throw Error('Open the company website first.');
  const requested=new URL(frame.src);
  if(requested.origin!==origin||!['/business/','/business/index.html'].includes(requested.pathname))throw Error('Page control is available only for our company demo.');
  let page,win;
  for(let i=0;i<50;i++){try{win=frame.contentWindow;page=frame.contentDocument;if(page?.readyState==='complete'&&win.location.pathname.startsWith('/business/'))break;}catch{}page=null;await new Promise(r=>setTimeout(r,100));}
  if(!page)throw Error('Company page is still loading. Try again shortly.');
  const buttons=[...page.querySelectorAll('[data-task]')];
  if(a.action==='click'){const button=buttons.find(b=>b.dataset.task===a.control_id);if(!button||button.disabled)throw Error('Read the page and choose an available control_id.');button.click();button.scrollIntoView({behavior:'instant',block:'center'});if(button.getAttribute('aria-pressed')!=='true')throw Error('The requested example did not activate. Read the page again.');}
  else if(a.action==='section'){const target=page.getElementById(a.section);if(!target||!['intro','help','about','followup'].includes(a.section))throw Error('Choose intro, help, about, or followup.');target.scrollIntoView({behavior:'instant',block:'start'});}
  else if(a.action==='scroll'){if(!['up','down','top','bottom'].includes(a.direction))throw Error('Choose up, down, top, or bottom.');const h=win.innerHeight;win.scrollTo({top:a.direction==='top'?0:a.direction==='bottom'?page.documentElement.scrollHeight:win.scrollY+(a.direction==='up'?-h:h)*.75,behavior:'instant'});}
  else if(a.action!=='read')throw Error('Unknown company page action.');
  return{ok:true,url:win.location.href,scrollY:win.scrollY,controls:buttons.map(b=>({control_id:b.dataset.task,label:b.textContent,selected:b.getAttribute('aria-pressed')==='true'})),example:page.getElementById('example')?.innerText||'',sections:['intro','help','about','followup'].map(id=>({id,text:page.getElementById(id)?.innerText?.slice(0,2500)||''})),note:'Describe the relevant services briefly using this page content. Contact entry is available through open_contact_form in the main canvas.'};
 }
 return {open,close,results,companyAction};
}
