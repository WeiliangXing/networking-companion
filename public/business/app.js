const samples={'Replies':'Hi Jamie, thanks for reaching out. Could you share a little more about the work you need and your preferred timing?','Follow-ups':'Hi Jamie, just checking in on the garden cleanup quote. Happy to answer any questions or talk through the next step.','Checklists':'Before the visit: confirm the address, review the agreed scope, check supplies, and share arrival details with the customer.'};document.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-task]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.getElementById('example').textContent=samples[b.dataset.task];document.querySelector('.sheet .stamp span:last-child').textContent=b.textContent;document.querySelector('.sheet h3').textContent={Replies:'A new inquiry. A clear first reply.', 'Follow-ups':'A quote sent. A busy week. No reply.',Checklists:'A repeatable task. A checklist for the team.'}[b.dataset.task];});

const form=document.querySelector('#guest-form');
form.addEventListener('submit',event=>{
 event.preventDefault();const values=Object.fromEntries(new FormData(form));
 const subject='Following up — '+values.guest;
 const body='Hi William and Joanna,\n\nIt was nice connecting and trying your AI assistant. I’d like to learn more about '+values.interest.toLowerCase()+'.'+(values.business?' My business is '+values.business+'.':'')+'\n\nBest,\n'+values.guest;
 document.querySelector('#email-content').textContent='To: xingwl0403@gmail.com\nSubject: '+subject+'\n\n'+body;
 document.querySelector('#email-link').href='mailto:xingwl0403@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 const panel=document.querySelector('.email');panel.hidden=false;panel.scrollIntoView({block:'center'});
});
