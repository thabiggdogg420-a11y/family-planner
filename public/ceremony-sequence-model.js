// Local, private operator tooling. No network, storage, media playback or inferred facts.
import {eventDetails,ceremonySequenceDetails,withCeremonySequence,validateSequenceItems,BODY_PRESENCE,validateEvent,blankEvent} from './planning-model.js';
import {validateBackup,serializeBackup} from './memorial-backup.js';
import {canonicalWorkspace} from './planning-ai.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const contextDrafts=new WeakMap(),drafts=new WeakMap(),reviews=new WeakMap(),runReviews=new WeakMap();
function normalize(w){return validateBackup({schemaVersion:w.planning?2:1,memorial:w.memorial,privatePlan:w.privatePlan,...(w.planning?{planning:w.planning}:{})});}
const canonical=w=>canonicalWorkspace(normalize(w));
function context(w){const event=eventDetails(w.planning);return JSON.stringify({name:w.memorial.name,bodyPresence:w.planning?.arrangements?.bodyPresence??null,...Object.fromEntries(['title','date','time','timezone','venue','address'].map(k=>[k,event[k]]))});}
export function guestSequenceText(items){return validateSequenceItems(items).map(item=>item.title?item.title+(item.words?'\n'+item.words:''):item.words).filter(text=>text.length>0).join('\n\n');}
export function sequenceAssessment(workspace){
 const w=normalize(workspace),sequence=ceremonySequenceDetails(w.planning);
 if(!sequence)return {recorded:false,stale:false,canRun:false,items:[],serviceBasis:'',contextBasis:''};
 const stale=sequence.serviceBasis!==w.memorial.service||guestSequenceText(sequence.items)!==sequence.serviceBasis||sequence.contextBasis!==context(w);
 return {recorded:true,stale,canRun:!stale&&sequence.items.length>0,...sequence};
}
export function createSequenceDraft(workspace){
 const w=normalize(workspace),a=sequenceAssessment(w);
 const items=a.recorded&&!a.stale?clone(a.items):w.memorial.service.length?[{id:'moment-1',title:'',words:w.memorial.service,owner:'',cue:'',fallback:''}]:[];
 const draft={items};drafts.set(draft,canonical(w));return draft;
}
const contextLabels=Object.freeze({title:'Event heading',date:'Event date',time:'Start time',timezone:'Time zone / local label',venue:'Venue / gathering place',address:'Guest address'});
export function sequenceContextRecovery(workspace){
 const w=normalize(workspace),a=sequenceAssessment(w),blocked=reason=>({eligible:false,reason,changes:[]});
 if(!a.recorded||!a.items.length)return blocked('There are no recorded moments to recover.');
 if(!a.stale)return blocked('The recorded sequence already matches the current words and event details.');
 if(a.serviceBasis!==w.memorial.service||guestSequenceText(a.items)!==a.serviceBasis)return blocked('Guest service words changed. Keep the current words; use the historical copy only as a reference rather than merging old moments automatically.');
 let before;try{before=JSON.parse(a.contextBasis);}catch{return blocked('The earlier event context cannot be understood safely. Use the historical copy as a reference.');}
 const now=JSON.parse(context(w)),keys=Object.keys(now).sort().join(',');
 if(!before||typeof before!=='object'||Array.isArray(before)||Object.keys(before).sort().join(',')!==keys||Object.keys(before).some(k=>k==='bodyPresence'?(before[k]!==null&&(typeof before[k]!=='string'||!Object.hasOwn(BODY_PRESENCE,before[k]))):typeof before[k]!=='string'))return blocked('The earlier event context cannot be understood safely. Use the historical copy as a reference.');
 try{validateEvent({...blankEvent(),...Object.fromEntries(Object.keys(contextLabels).map(k=>[k,before[k]]))});}catch{return blocked('The earlier event details do not match the supported date, time and text limits. Use the historical copy as a reference.');}
 if(before.name!==now.name)return blocked('The recorded name changed. The app cannot decide whether earlier moments belong to this person; use the historical copy as a reference.');
 if(before.bodyPresence!==now.bodyPresence)return blocked('The event’s body-presence choice changed. Review the current plan and rebuild relevant moments rather than carrying private cues across automatically.');
 const changes=Object.entries(contextLabels).filter(([key])=>before[key]!==now[key]).map(([key,label])=>({key,label,before:before[key],after:now[key]}));
 if(!changes.length)return blocked('No understood event-detail change can be isolated safely. Use the historical copy as a reference.');
 return {eligible:true,reason:'Guest service words, recorded name and body-presence choice are unchanged. Earlier moments can be copied into a temporary draft for explicit review against the changed event details.',changes};
}
export function createContextRecoveryDraft(workspace){
 const w=normalize(workspace),recovery=sequenceContextRecovery(w);if(!recovery.eligible)throw Error(recovery.reason);
 const draft={items:clone(sequenceAssessment(w).items)};drafts.set(draft,canonical(w));contextDrafts.set(draft,freeze(clone(recovery.changes)));return draft;
}
export function prepareSequenceReview(workspace,draft){
 const w=normalize(workspace);
 if(drafts.get(draft)!==canonical(w))throw Error('This sequence draft no longer matches the workspace. Keep the newer work and restart the review.');
 if(Object.keys(draft).length!==1||!Array.isArray(draft.items))throw Error('Review only supported ceremony moments.');
 const items=validateSequenceItems(draft.items),service=guestSequenceText(items);
 if(service.length>20000)throw Error('Combined guest service words exceed 20,000 characters. Shorten this draft; recorded work is unchanged.');
 const next=normalize(w);next.memorial.service=service;next.planning=withCeremonySequence(w.planning,{items,serviceBasis:service,contextBasis:context(w)});next.planning.revision++;
 serializeBackup(next);
 const review=freeze({...(contextDrafts.has(draft)?{contextChanges:clone(contextDrafts.get(draft))}:{}),beforeService:w.memorial.service,guestService:service,items:clone(items),clearsService:!!w.memorial.service&&!service,notice:'Only the guest heading and words enter the programme service text. Recorded owner, cue and fallback stay private. A recorded owner is not agreement; no timing or media is created.'});
 reviews.set(review,{snapshot:canonical(w),next});return review;
}
export function discardSequenceReview(review){reviews.delete(review);}
export function approveSequenceReview(review,workspace,{consent=false}={}){
 const entry=reviews.get(review);if(!entry)throw Error('Make a fresh sequence review first.');
 if(consent!==true)throw Error('Explicitly approve this exact guest text and private cue record first.');
 reviews.delete(review);if(entry.snapshot!==canonical(workspace))throw Error('The workspace changed after review. Nothing was applied; restart from current information.');return clone(entry.next);
}
export function sequencePrivateLines(workspace){
 const a=sequenceAssessment(workspace);if(!a.recorded)throw Error('Record a ceremony sequence before selecting private cues.');if(a.stale)throw Error('The ceremony sequence is stale. Review current words and context before including cues.');
 const lines=['PRIVATE operator cues — not a guest copy or a completed rehearsal. Owners are recorded notes, not accepted assignments. No durations or event timings are inferred.'];
 if(!a.items.length)lines.push('No moments recorded. No ceremony is required by this app.');
 for(const [i,item]of a.items.entries())lines.push('Moment '+(i+1)+': '+(item.title||'Heading not recorded')+'\nGuest words: '+(item.words||'No words recorded')+'\nPrivate recorded owner: '+(item.owner||'Unknown — agree separately')+'\nPrivate cue: '+(item.cue||'Not recorded')+'\nPrivate fallback: '+(item.fallback||'Not recorded'));
 return lines;
}
export function prepareSequenceRun(workspace){
 const w=normalize(workspace),a=sequenceAssessment(w);if(!a.canRun)throw Error(a.stale?'The sequence changed. Review the current words and context before operating it.':'Record at least one ceremony moment before starting a private play-through.');
 const review=freeze({items:clone(a.items),notice:'PRIVATE OPERATOR SCREEN — do not project or share this whole screen. It includes private owner, cue and fallback notes. No audio/video plays and nothing is marked rehearsed or complete.'});
 runReviews.set(review,{snapshot:canonical(w),items:clone(a.items)});return review;
}
export function discardSequenceRunReview(review){runReviews.delete(review);}
export function approveSequenceRun(review,workspace,{consent=false}={}){
 const entry=runReviews.get(review);if(!entry)throw Error('Make a fresh private operator review first.');if(consent!==true)throw Error('Explicitly approve opening the private operator screen.');runReviews.delete(review);
 let active=true,index=0,paused=false;
 function check(current){if(!active)throw Error('The operator session is closed. Review again before starting.');try{if(canonical(current)!==entry.snapshot)throw Error('The workspace changed.');}catch{active=false;throw Error('The workspace changed. The operator session closed; review current information before restarting.');}}
 check(workspace);
 return Object.freeze({
  view(current){check(current);return Object.freeze({index,total:entry.items.length,paused,item:paused?null:clone(entry.items[index]),next:paused||index===entry.items.length-1?null:clone(entry.items[index+1])});},
  move(delta,current){check(current);if(paused||![-1,1].includes(delta))throw Error('Resume or restart before moving, and use one step at a time.');const next=index+delta;if(next<0||next>=entry.items.length)throw Error('Already at the boundary of the recorded sequence.');index=next;},
  jump(target,current){check(current);if(paused||!Number.isInteger(target)||target<0||target>=entry.items.length)throw Error('Choose an existing moment while the session is running.');index=target;},
  pause(current){check(current);paused=true;},
  resume(current){check(current);paused=false;},
  finish(current){check(current);active=false;},
  restart(current){check(current);index=0;paused=false;},
  close(){active=false;}
 });
}
export function sequenceWorkspaceKey(workspace){return canonical(workspace);}
