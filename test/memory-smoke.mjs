// Optional live model check. Uses synthetic input and simulated tool results; writes no user data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {personalInstructions,personalTools} from '../src/profile.js';
const vars=Object.fromEntries(fs.readFileSync('.dev.vars','utf8').trim().split('\n').map(l=>{const i=l.indexOf('=');return[l.slice(0,i),JSON.parse(l.slice(i+1))]}));
const cases=[
 {name:'Ordinary chat does not save',text:'I enjoyed learning about robot data collection today.',check:c=>!c.some(x=>x.name==='save_note'||x.arguments.action==='save')},
 {name:'Natural save hint',text:'Make a note for later: I want to learn more about robot data collection.',check:c=>c.some(x=>x.name==='save_note'&&x.arguments.save_requested===true)},
 {name:'Retrieve after fresh start',text:'Who did I connect with earlier? Look up my saved people.',check:c=>c.some(x=>x.name==='recall_memory'&&x.arguments.kind==='people')},
 {name:'Draft from saved person',text:'Draft a follow-up email to Alex I met earlier. Look up his saved details and mention what we discussed. Do not save the draft yet.',check:c=>c.some(x=>x.name==='recall_memory')&&c.some(x=>x.name==='workspace_item'&&x.arguments.action==='create'&&x.arguments.recipient==='alex@example.com')&&!c.some(x=>x.arguments.action==='save')}
];
for(const c of cases){let input=[{role:'user',content:c.text}],calls=[];for(let turn=0;turn<4;turn++){
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+vars.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.4',store:false,instructions:personalInstructions,tools:personalTools,input,max_output_tokens:700,reasoning:{effort:'low'}})});
 if(!r.ok)throw Error('Model check failed: '+r.status);
 const data=await r.json(),next=(data.output||[]).filter(x=>x.type==='function_call');
 if(!next.length)break;
 input.push(...data.output);
 for(const call of next){const args=JSON.parse(call.arguments);calls.push({name:call.name,arguments:args});let result={ok:true};const person={id:'synthetic-alex',name:'Alex',email:'alex@example.com',summary:'Discussed collecting diverse robot demonstrations'};
 if(call.name==='recall_memory')result=args.kind==='person'?{person:{id:person.id,profile:person}}:{people:[person]};
 if(call.name==='workspace_item')result={item:{id:'local-1',...args,revision:1},saved:false};
 input.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)});
 }
 if(c.name!=='Draft from saved person'||calls.some(x=>x.name==='workspace_item'))break;
 }
 assert.ok(c.check(calls),c.name+' failed');if(c.name==='Draft from saved person'){const draft=calls.find(x=>x.name==='workspace_item'&&x.arguments.action==='create').arguments;assert.match(draft.body,/AI companion/i);assert.ok(draft.body.split(/\s+/).length<=120);assert.ok(!/\[[^\]]+\]/.test(draft.body));}console.log('PASS '+c.name+' ['+calls.map(x=>x.name).join(', ')+']');
}
