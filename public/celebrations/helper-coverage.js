// Item-to-handover relationship only. Never count people, verify assignments or infer readiness.
import {latestHelperResponses,helperResponseCurrent} from './helper-responses.js';
export function helperCoverage(o){
 const records=latestHelperResponses(o),items=[...o.tasks.map(t=>({key:`task:${t.id}`,kind:'task',label:t.text||'Task not named',detail:`${t.done?'Organiser marked done':'Organiser task'} · ${t.owner||'No alias'} · ${t.gatheringId?o.gatherings.find(g=>g.id===t.gatheringId)?.title||'Gathering not found':'Whole occasion'}`,selection:{heading:'Task discussion',taskIds:[t.id]},matches:r=>r.selection.taskIds.includes(t.id)})),...o.gatherings.flatMap(g=>g.sequence.map((cue,index)=>({key:`cue:${g.id}:${index}`,kind:'cue',label:cue.activity||'Cue not named',detail:`${g.title||'Gathering not named'} · ${g.date||'Date not set'} · ${cue.time||'Time not set'} · ${cue.owner||'No alias'}`,selection:{heading:'Running-order discussion',runItems:[{gatheringId:g.id,index}]},matches:r=>r.selection.runItems.some(x=>x.gatheringId===g.id&&x.index===index)})))];
 return items.map(({matches,...item})=>{
  const related=records.filter(matches).map(r=>({id:r.id,heading:r.selection.heading,status:r.status,current:helperResponseCurrent(o,r),taskCount:r.selection.taskIds.length,cueCount:r.selection.runItems.length}));
  const current=related.filter(r=>r.current),statuses=new Set(current.map(r=>r.status));
  const state=!current.length?(related.length?'needs-reconfirmation':'no-record'):statuses.size>1?'mixed-reports':current[0].status;
  return {...item,state,related,overlapping:current.length>1,needsReview:state!=='reported-accepted'};
 });
}
export function coverageSelection(o,key){const item=helperCoverage(o).find(x=>x.key===key);if(!item)throw Error('That task or cue changed or was removed. Review the current items.');return structuredClone(item.selection);}
