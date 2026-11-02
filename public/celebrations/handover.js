// Explicit guest allowlist. Never include private budgets, tasks, roles, intentions or operator sequences.
export function guestCopy(occasion,{heading='Gathering details',gatheringIds=[],includePractical=false}={}){
 if(typeof heading!=='string'||heading.trim().length===0||heading.length>120)throw Error('Give this guest copy a short heading.');
 if(!Array.isArray(gatheringIds)||!gatheringIds.length||gatheringIds.length>12||new Set(gatheringIds).size!==gatheringIds.length||gatheringIds.some(id=>typeof id!=='string'))throw Error('Choose at least one gathering, without duplicates.');
 if(typeof includePractical!=='boolean')throw Error('Choose whether to include guest practical notes.');
 const gatherings=gatheringIds.map(id=>{const g=occasion.gatherings.find(g=>g.id===id);if(!g)throw Error('A selected gathering no longer exists. Review the selection.');return {name:g.title.trim()||'Gathering',date:g.date,time:g.time,venue:g.venue.trim()};});
 return {heading:heading.trim(),gatherings,practical:includePractical?occasion.practical.trim():''};
}
export function createGuestReview(occasion,options,{now=new Date()}={}){return {occasionId:occasion.id,source:JSON.stringify(occasion),selection:structuredClone(options),preparedAt:now.toISOString(),copy:guestCopy(occasion,options)};}
export function guestReviewCurrent(occasion,review){try{return !!review&&occasion.id===review.occasionId&&JSON.stringify(occasion)===review.source&&typeof review.preparedAt==='string'&&new Date(review.preparedAt).toISOString()===review.preparedAt&&JSON.stringify(review.copy)===JSON.stringify(guestCopy(occasion,review.selection));}catch{return false;}}
