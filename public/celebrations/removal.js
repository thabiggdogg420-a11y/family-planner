// Local plan correction only. Never cancel suppliers or cascade-delete their history.
export function reviewRemoval(o,kind,id){
 if(!['task','gathering'].includes(kind))throw Error('Choose a task or gathering to remove.');
 const list=kind==='task'?o.tasks:o.gatherings,record=list.find(x=>x.id===id);
 if(!record)throw Error('That item no longer exists. Review the current plan.');
 if(kind==='gathering'){
  const reasons=[];
  if(o.gatherings.length<=1)reasons.push('Keep at least one gathering in this occasion.');
  const tasks=o.tasks.filter(t=>t.gatheringId===id);
  if(tasks.length)reasons.push(`${tasks.length} task(s) still refer to this gathering. Review their scope or remove them separately.`);
  const options=o.options.filter(x=>x.gatheringId===id);
  if(options.length)reasons.push(`${options.length} venue/supplier option(s) refer to this gathering. Their quote, response and budget history must be preserved; this removal cannot proceed.`);
  // Stale links retain an exact historical option even after its current scope changes.
  const historicalLinks=o.optionLinks.filter(link=>{try{return JSON.parse(link.source).gatheringId===id;}catch{throw Error('A budget link history cannot be inspected safely. Keep this gathering and review the link separately.');}});
  if(historicalLinks.length)reasons.push(`${historicalLinks.length} budget link snapshot(s) still refer to this gathering, including stale links. Review and explicitly remove the budget link separately before removing the gathering; no history is deleted here.`);
  if(o.research.request?.gatheringId===id)reasons.push('The current research request refers to this gathering. Its evidence must be preserved; this removal cannot proceed.');
  if(o.research.imports.some(x=>x.request?.gatheringId===id||x.package?.gatheringId===id))reasons.push('Imported research history refers to this gathering. It cannot be deleted by this action.');
  if((o.moneyFollowups??[]).some(x=>x.versions.some(v=>v.gatheringId===id)))reasons.push('Private money follow-up history refers to this gathering. It cannot be cascade-deleted.');
  if(o.responses.some(x=>x.input?.gatheringId===id))reasons.push('Recorded supplier response history refers to this gathering. It cannot be deleted by this action.');
  if(reasons.length)throw Error(reasons.join(' '));
 }
 return {occasionId:o.id,source:JSON.stringify(o),kind,id,record:structuredClone(record),before:list.length,after:list.length-1};
}
export function applyRemoval(o,review){
 if(!review||review.occasionId!==o.id||review.source!==JSON.stringify(o))throw Error('The plan changed. Review removal again.');
 const fresh=reviewRemoval(o,review.kind,review.id);
 if(JSON.stringify(fresh)!==JSON.stringify(review))throw Error('The removal review changed. Review again.');
 const next=structuredClone(o);
 if(fresh.kind==='task')next.tasks=next.tasks.filter(x=>x.id!==fresh.id);
 else {next.gatherings=next.gatherings.filter(x=>x.id!==fresh.id);next.journey.completedCues=[];}
 return next;
}
// One-use review tokens also protect against old buttons and a newer review of the same item.
export function createRemovalSession({getOccasion,replaceOccasion,isBusy=()=>false}){
 let pending=null,serial=0;
 return {
  clear(){pending=null;serial++;},
  review(kind,id){pending=null;const token=++serial;if(isBusy())throw Error('Wait for the current draft operation to finish.');const review=reviewRemoval(getOccasion(),kind,id);pending={token,review};return structuredClone(pending);},
  apply(token){if(!pending||pending.token!==token)throw Error('This removal review is no longer current.');if(isBusy())throw Error('Wait for the current draft operation to finish.');const next=applyRemoval(getOccasion(),pending.review);pending=null;serial++;replaceOccasion(next);return next;}
 };
}
