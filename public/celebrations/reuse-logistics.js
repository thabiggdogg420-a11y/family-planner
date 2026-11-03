// Explicit text/structure reuse only; never clone a private occasion.
import {occasion,gathering} from './model.js';
import {validateData} from './retention.js';
function selection(ids,records,label){if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!records.some(r=>r.id===id)))throw Error('Choose current, distinct '+label+'.');return records.filter(r=>ids.includes(r.id));}
export function reviewReuse(data,sourceId,input,newId){
 validateData(data);if(data.occasions.length>=12)throw Error('This session already has 12 occasions. Nothing copied.');
 const source=data.occasions.find(o=>o.id===sourceId);if(!source)throw Error('Source occasion no longer exists.');
 if(!input||Object.keys(input).length!==4||!['title','intention','taskIds','gatheringIds'].every(k=>Object.hasOwn(input,k)))throw Error('Review exactly the fresh title, intention and selected items.');
 if(typeof input.title!=='string'||!input.title.trim()||input.title.length>300||typeof input.intention!=='string'||!input.intention.trim()||input.intention.length>2000)throw Error('Enter a fresh title and purpose (up to 300 and 2000 characters).');
 if(typeof newId!=='string'||!/^[-a-zA-Z0-9_]{1,50}$/.test(newId)||data.occasions.some(o=>o.id===newId))throw Error('Choose a fresh occasion identity.');
 const tasks=selection(input.taskIds,source.tasks,'task texts'),groups=selection(input.gatheringIds,source.gatherings,'gathering structures');
 if(!tasks.length&&!groups.length)throw Error('Select at least one reusable item, or start a fresh occasion instead.');
 for(const t of tasks)if(t.gatheringId&&!groups.some(g=>g.id===t.gatheringId))throw Error('Select the gathering for each scoped task, or leave that task out. Task scope will not be broadened.');
 const used=new Set(data.occasions.flatMap(o=>[o.id,...o.tasks.map(t=>t.id),...o.gatherings.map(g=>g.id)]));let serial=0;
 const id=kind=>{let v;do{v=`${newId}-${kind}-${++serial}`;}while(used.has(v));used.add(v);return v;};
 const next=occasion(newId,'other');next.title=input.title.trim();next.intention=input.intention.trim();next.tasks=[];
 const map=new Map();next.gatherings=groups.map(old=>{const fresh=gathering(id('g'),old.title);map.set(old.id,fresh.id);fresh.sequence=old.sequence.map(r=>({time:'',activity:r.activity,owner:''}));return fresh;});
 if(!next.gatherings.length)next.gatherings=[gathering(id('g'),'Your gathering')];
 next.tasks=tasks.map(t=>({id:id('t'),text:t.text,done:false,owner:'',due:'',gatheringId:t.gatheringId?map.get(t.gatheringId):''}));
 validateData({occasions:[...data.occasions,next],active:newId});
 return {sourceId,base:JSON.stringify(data),input:structuredClone(input),newId,next};
}
export function applyReuse(data,review){
 if(!review||review.base!==JSON.stringify(data))throw Error('The workspace changed. Prepare a fresh reuse review.');
 const fresh=reviewReuse(data,review.sourceId,review.input,review.newId);
 if(JSON.stringify(fresh)!==JSON.stringify(review))throw Error('The reviewed contents changed. Prepare a fresh review.');
 return {occasions:[...structuredClone(data.occasions),fresh.next],active:fresh.newId};
}
