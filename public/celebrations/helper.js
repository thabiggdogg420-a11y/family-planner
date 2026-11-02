// Explicit selection only: aliases are labels, never recipient identities or consent.
export function helperCopy(o,{heading='Helper handover',taskIds=[],runItems=[],gatheringIds=[],includePractical=false}={}){
 if(typeof heading!=='string'||!heading.trim()||heading.length>120)throw Error('Give this handover a short heading.');
 if(!Array.isArray(taskIds)||!Array.isArray(runItems)||(!taskIds.length&&!runItems.length&&!gatheringIds.length)||new Set(taskIds).size!==taskIds.length)throw Error('Choose tasks or run-sheet items explicitly, without duplicates.');
 const tasks=taskIds.map(id=>{const t=o.tasks.find(t=>t.id===id);if(!t)throw Error('Selected task no longer exists.');const g=t.gatheringId?o.gatherings.find(g=>g.id===t.gatheringId):null;if(t.gatheringId&&!g)throw Error('Task gathering no longer exists.');return {text:t.text,done:t.done,owner:t.owner,due:t.due,scope:g?g.title:'Whole occasion'};});
 const keys=runItems.map(r=>`${r.gatheringId}:${r.index}`);if(new Set(keys).size!==keys.length)throw Error('Choose each run-sheet item once.');
 const sequence=runItems.map(r=>{const g=o.gatherings.find(g=>g.id===r.gatheringId);if(!g||!Number.isInteger(r.index)||r.index<0||!g.sequence[r.index])throw Error('Selected run-sheet item no longer exists.');const item=g.sequence[r.index];return {gathering:g.title,date:g.date,time:item.time,activity:item.activity,owner:item.owner};});
 if(!Array.isArray(gatheringIds)||new Set(gatheringIds).size!==gatheringIds.length||typeof includePractical!=='boolean')throw Error('Choose gathering logistics explicitly, without duplicates.');
 const copy={heading:heading.trim(),tasks,sequence};
 if(gatheringIds.length)copy.gatherings=gatheringIds.map(id=>{const g=o.gatherings.find(g=>g.id===id);if(!g)throw Error('Selected gathering no longer exists.');return {name:g.title,date:g.date,time:g.time,venue:g.venue};});
 if(includePractical)copy.practical=o.practical;
 return copy;
}
export function createHelperReview(o,options){return {occasionId:o.id,source:JSON.stringify(o),selection:structuredClone(options),copy:helperCopy(o,options)};}
export function helperReviewCurrent(o,r){try{return !!r&&r.occasionId===o.id&&r.source===JSON.stringify(o)&&JSON.stringify(r.copy)===JSON.stringify(helperCopy(o,r.selection));}catch{return false;}}
