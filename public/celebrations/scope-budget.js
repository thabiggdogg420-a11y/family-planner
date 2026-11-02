// Derived freshness, not supplier verification. Historical captures are never rewritten.
import {validateQuantities} from './quantities.js';
export function optionLinkCurrent(o,link){
 if(!link||link.invalidated)return false;
 const option=o.options?.find(x=>x.id===link.optionId);if(!option||link.source!==JSON.stringify(option))return false;
 const response=(o.responses??[]).filter(r=>r.input?.optionId===option.id).at(-1);
 const gathering=o.gatherings?.find(g=>g.id===option.gatheringId);
 return !response||!!gathering&&response.gatheringSource===JSON.stringify(gathering);
}
export function setGatheringScope(o,gatheringId,field,value){
 if(!['date','time','venue'].includes(field)||typeof value!=='string'||value.length>300)throw Error('Choose a current gathering date, time or place.');
 if(field==='date'&&value!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw Error('Enter a real gathering date.');
 if(field==='time'&&value!==''&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Enter a valid gathering time.');
 const g=o.gatherings.find(g=>g.id===gatheringId);if(!g)throw Error('Gathering no longer exists.');
 const q=validateQuantities(g.quantities);if(g[field]===value)return structuredClone(o);
 if(q.revision===Number.MAX_SAFE_INTEGER)throw Error('Gathering assumption revision limit reached; no change applied.');
 const next=structuredClone(o),target=next.gatherings.find(x=>x.id===gatheringId);target[field]=value;
 // Existing private revision also binds date/time/place scope. Never exported in a brief.
 target.quantities.revision++;
 const affected=new Set(next.options.filter(x=>x.gatheringId===gatheringId).map(x=>x.id));
 for(const link of next.optionLinks)if(affected.has(link.optionId))link.invalidated=true;
 next.journey.completedCues=[];return next;
}
