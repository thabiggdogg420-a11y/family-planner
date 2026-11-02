import {createHelperReview} from './helper.js';
// Derived organiser-only recovery routes. No persisted flags, readiness verdict or repairs.
import {optionLinkCurrent} from './scope-budget.js';
import {researchRequestCurrent,researchEvidenceCurrent} from './research.js';
import {helperResponseCurrent,latestHelperResponses} from './helper-responses.js';
export function recoveryActions(o){
 const rows=[],request=o.research.request;
 const staleRequest=!!request&&!researchRequestCurrent(o),priorEvidence=!!request&&o.research.imports.some(i=>i.request.gatheringId===request.gatheringId),currentEvidence=!!request&&o.research.imports.some(i=>i.optionIds.some(id=>researchEvidenceCurrent(o,id)));
 if(request&&(staleRequest||priorEvidence&&!currentEvidence))rows.push({key:`research:${request.requestId}:${request.revision}`,kind:'research',id:request.requestId,evidence:!staleRequest,label:o.gatherings.find(g=>g.id===request.gatheringId)?.title||'Earlier gathering',reason:staleRequest?'The research brief captures earlier gathering details. Review the current scope before using evidence or preparing an enquiry.':'Earlier imported sources do not match the current reviewed request. Add or import fresh evidence before preparing an enquiry; older sources remain history.',action:staleRequest?'Review this gathering’s research brief':'Review fresh sources for this brief'});
 for(const option of o.options){
  const link=o.optionLinks.find(l=>l.optionId===option.id),last=o.responses.filter(r=>r.input.optionId===option.id).at(-1),g=o.gatherings.find(g=>g.id===option.gatheringId);
  // Same exact option/scope comparison used by the existing response and comparison views.
  const staleResponse=!!last&&(last.afterSource!==JSON.stringify(option)||last.gatheringSource!==JSON.stringify(g)),staleLink=!!link&&!optionLinkCurrent(o,link);
  if(staleResponse||staleLink)rows.push({key:`option:${option.id}`,kind:'option',id:option.id,label:`${g?.title||'Earlier gathering'} · ${option.name||'Unnamed option'}`,reason:[staleResponse?'The recorded supplier response no longer matches this option or gathering. Check current evidence.':'',staleLink?'Its earlier budget link is excluded. Review the facts, then separately remove/review the budget link if still wanted.':''].filter(Boolean).join(' '),action:staleResponse?'Review this option and its response':'Review this excluded budget link',response:staleResponse});
 }
 for(const record of latestHelperResponses(o))if(!helperResponseCurrent(o,record)){
  // Removed selections remain in helper history, not an unfinishable current repair queue.
  try{createHelperReview(o,record.selection);}catch{continue;}
  rows.push({key:`helper:${record.id}`,kind:'helper',id:record.id,label:record.selection.heading,reason:'Earlier selected helper details changed or were removed. Review the current selection before recording any fresh reported response. Shared copies do not update.',action:'Review this helper selection'});}

 const order=o.journey.stage==='day-of'?['helper','option','research']:o.journey.stage==='wrap-up'?['option','helper','research']:['research','option','helper'];
 return rows.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
}
export function recoveryTarget(o,occasionId,key){
 if(o.id!==occasionId)throw Error('The occasion changed. Return to the guided journey.');
 const item=recoveryActions(o).find(x=>x.key===key);
 if(!item)throw Error('These details changed or no longer need this review. Return to the guided journey.');
 return item;
}
export function renderRecovery(o,esc){
 const rows=recoveryActions(o);if(!rows.length)return '';
 return `<section class="card actions" data-private-recovery aria-labelledby="recovery-heading"><h3 id="recovery-heading" tabindex="-1">Review changed arrangements</h3><p>These earlier records need attention even if your task checkboxes are done. Choose one to review; nothing is repaired, relinked, sent or confirmed automatically.</p><ul>${rows.map(r=>`<li class="preserve"><strong>${esc(r.label)}</strong><p>${esc(r.reason)}</p><button type="button" data-recovery-key="${esc(r.key)}" data-recovery-occasion="${esc(o.id)}">${esc(r.action)}</button></li>`).join('')}</ul><p class="small">This only checks existing recorded dependencies, not every arrangement or whether the occasion is ready. Earlier shared copies must be replaced manually if needed.</p></section>`;
}
