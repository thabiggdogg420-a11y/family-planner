// Transactional local change preview; reuses existing freshness rules, never new persisted state.
import {setGatheringScope} from './scope-budget.js';
import {setQuantities} from './quantities.js';
import {invalidateHelperResponses} from './helper-responses.js';
import {recoveryActions} from './recovery.js';
import {budget} from './model.js';
const fields=['date','time','venue','headcount','seats','meals'];
export function changeInput(g){return {date:g.date,time:g.time,venue:g.venue,headcount:g.quantities.headcount,seats:g.quantities.seats,meals:g.quantities.meals};}
export function previewChange(o,gatheringId,input){
 const g=o.gatherings.find(g=>g.id===gatheringId);if(!g)throw Error('Choose a current gathering.');
 if(!input||Object.keys(input).length!==fields.length||fields.some(k=>typeof input[k]!=='string'))throw Error('Review exactly the six gathering fields.');
 const before=changeInput(g),changes=fields.filter(k=>before[k]!==input[k]).map(field=>({field,before:before[field],after:input[field]}));
 if(!changes.length)throw Error('No changed details yet. Enter a different date, time, place or quantity.');
 let next=structuredClone(o);for(const k of ['date','time','venue'])next=setGatheringScope(next,gatheringId,k,input[k]);next=setQuantities(next,gatheringId,Object.fromEntries(['headcount','seats','meals'].map(k=>[k,input[k]])));invalidateHelperResponses(next);
 const oldKeys=new Set(recoveryActions(o).map(r=>r.key));const rows=recoveryActions(next);
 const added=rows.filter(r=>!oldKeys.has(r.key));
 const existing=rows.filter(r=>oldKeys.has(r.key)&&((r.kind==='option'&&o.options.find(x=>x.id===r.id)?.gatheringId===gatheringId)||(r.kind==='research'&&o.research.request?.gatheringId===gatheringId)||(r.kind==='helper'&&o.helperResponses.find(x=>x.id===r.id)?.snapshot.context.some(x=>x.id===gatheringId))));
 return {occasionId:o.id,gatheringId,source:JSON.stringify(o),input:structuredClone(input),changes,added,existing,beforeBudget:budget(o),afterBudget:budget(next),next};
}
export function applyChange(o,review){
 if(!review||review.occasionId!==o.id||review.source!==JSON.stringify(o))throw Error('The plan changed. Preview the change again; nothing applied.');
 const fresh=previewChange(o,review.gatheringId,review.input);if(JSON.stringify(fresh)!==JSON.stringify(review))throw Error('The change preview changed. Review it again.');return fresh.next;
}
export function undoChange(o,receipt){if(!receipt||receipt.occasionId!==o.id||receipt.after!==JSON.stringify(o))throw Error('Other edits followed this change. Undo is no longer available; prepare a new reviewed change instead.');return structuredClone(receipt.before);}
