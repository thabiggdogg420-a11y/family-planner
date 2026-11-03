import {validateData} from './retention.js';

// Preserve identity-bound evidence. Never rekey, infer matching real events, or merge fields.
export function reviewSelectiveImport(current,incoming,actions){
 validateData(current);const base=structuredClone(current),source=validateData(incoming);
 if(!Array.isArray(actions)||!actions.length||actions.length>12)throw Error('Select at least one occasion to add or explicitly replace.');
 const seen=new Set(),changes=[];
 for(const action of actions){
  if(!action||typeof action!=='object'||Array.isArray(action)||Object.keys(action).length!==2||!Object.hasOwn(action,'id')||!Object.hasOwn(action,'action')||typeof action.id!=='string'||seen.has(action.id))throw Error('Choose distinct current file occasions.');
  seen.add(action.id);const after=source.occasions.find(o=>o.id===action.id),before=base.occasions.find(o=>o.id===action.id);
  if(!after||action.action!==(before?'replace':'add'))throw Error('Review each collision explicitly; no occasion is silently replaced or renamed.');
  changes.push({action:action.action,id:action.id,before:before??null,after});
 }
 const replacements=new Map(changes.filter(c=>c.action==='replace').map(c=>[c.id,c.after]));
 const additions=changes.filter(c=>c.action==='add').map(c=>c.after);
 if(base.occasions.length+additions.length>12)throw Error('Selected additions exceed the 12-occasion limit. Nothing changed.');
 const next=validateData({occasions:[...base.occasions.map(o=>replacements.get(o.id)??o),...additions],active:base.active});
 for(const original of current.occasions){if(!replacements.has(original.id)&&JSON.stringify(next.occasions.find(o=>o.id===original.id))!==JSON.stringify(original))throw Error('An unselected current occasion needs evidence reconciliation. Nothing changed. Review that occasion before importing.');}
 // Bound the resulting portable record too, not only each incoming file.
 if(new TextEncoder().encode(JSON.stringify({format:'family-occasions-private-draft',version:12,revision:'portable-backup',data:next},null,2)+'\n').length>1000000)throw Error('Combined backup exceeds 1 MB. Select fewer occasions. Nothing changed.');
 return {base:JSON.stringify(current),source:JSON.stringify(incoming),actions:structuredClone(actions),changes,next};
}

export function applySelectiveImport(current,review){
 if(!review||review.base!==JSON.stringify(current))throw Error('The current workspace changed. Read and review the backup again.');
 let incoming;try{incoming=JSON.parse(review.source);}catch{throw Error('The source review changed. Read the backup again.');}
 const fresh=reviewSelectiveImport(current,incoming,review.actions);
 if(JSON.stringify(fresh)!==JSON.stringify(review))throw Error('The selected review changed. Read and review the backup again.');
 return fresh.next;
}
