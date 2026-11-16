import test from 'node:test';
import assert from 'node:assert/strict';
import {researchGuest} from '../src/guest-research.js';
test('research requires identifying context and returns sourced temporary findings',async()=>{
 let calls=0;const ai=async(env,path,payload)=>{calls++;assert.equal(payload.store,false);assert.match(payload.instructions,/hypotheses/);return{json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'Verified facts and potential fit.',annotations:[{type:'url_citation',title:'Official',url:'https://example.com'}]}]}]})};};
 await assert.rejects(researchGuest({}, {name:'Alex'},ai),/company/);assert.equal(calls,0);
 const r=await researchGuest({}, {company:'Example',context:'Lexington'},ai);assert.equal(r.saved,false);assert.equal(r.citations.length,1);
 await assert.rejects(researchGuest({}, {company:'Example'},async()=>({json:async()=>({status:'completed',output:[]})})),/No verified sources/);
});

test('fallback query requests specific workflow analysis instead of search-result links',async()=>{
 const r=await researchGuest({}, {query:'Wilson Farm in Lexington'},async(env,path,payload)=>{
  assert.match(payload.instructions,/specific deliverable/);assert.match(payload.instructions,/do not return search results/);assert.equal(JSON.parse(payload.input).query,'Wilson Farm in Lexington');
  return{json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'How we could help: inquiry workflow.',annotations:[{type:'url_citation',url:'https://www.wilsonfarm.com/',title:'Wilson Farm'}]}]}]})};
 });assert.equal(r.title,'Wilson Farm in Lexington');
});

test('general restaurant search answers dining question without customer analysis',async()=>{
 const {searchWeb}=await import('../src/guest-research.js');
 const r=await searchWeb({}, {query:'Best Chinese food nearby'},async(env,path,payload)=>{
  assert.match(payload.instructions,/NOT customer research/);assert.match(payload.instructions,/Lexington, Massachusetts/);assert.equal(payload.tool_choice,'required');
  return{json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'Two dining options with reasons.',annotations:[{type:'url_citation',url:'https://example.com',title:'Restaurant'}]}]}]})};
 });assert.equal(r.answer,'Two dining options with reasons.');assert.equal(r.saved,false);
});
