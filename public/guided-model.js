// Deterministic local Guided Start. No AI, storage, networking, sending or inferred facts.
// Drafts and review tokens are temporary. Existing planning/memorial contracts remain authoritative.
import {createPlanning,eventDetails,validateEvent,withEventDetails,LIFECYCLES} from './planning-model.js';
import {validateBackup} from './memorial-backup.js';
import {blank} from './memorial-model.js';
import {canonicalWorkspace} from './planning-ai.js';
const reviews=new WeakMap(),drafts=new WeakMap();
const clone=value=>JSON.parse(JSON.stringify(value));
const FIELD_INFO={
 lifecycle:['Planning context','private',40],jurisdiction:['Country / state or region','private',120],name:['Name for guest documents','guest',200],
 wishes:['Private wishes and what matters','private',12000],story:['Life story','guest',20000],service:['Order of service / speaker cues','guest',20000],message:['Closing words','guest',20000],
 title:['Event heading','guest',500],date:['Event date','guest',500],time:['Event start time','guest',500],timezone:['Time zone / local time label','guest',500],venue:['Gathering place','guest',500],address:['Address for guests','guest',500],contact:['Guest RSVP / contact text','guest',500],guestInfo:['Guest practical / access information','guest',2000],arrivalTime:['Organiser arrival time','private',500],lead:['Day-of lead','private',500]
};
export const GUIDED_FIELD_LABELS=Object.freeze(Object.fromEntries(Object.entries(FIELD_INFO).map(([key,[label,audience]])=>[key,Object.freeze({label,audience})])));
export const GUIDED_OUTPUTS=Object.freeze(['organiser','invitation','runsheet','program','card','helper']);
const outputLabels={helper:'Helper task brief',organiser:'Private organiser plan',invitation:'Guest invitation / announcement',runsheet:'Private day-of sheet',program:'Guest programme',card:'Guest memorial card'};
const contextLabels={'not-sure':'Not sure yet',preplanning:'Planning ahead',arranging:'Arranging now',aftercare:'Aftercare and remembrance'};
function record(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw Error(label+' has missing or unsupported fields. Current work is unchanged.');}
function normalize(workspace){const hasPlanning=!!workspace&&Object.hasOwn(workspace,'planning');record(workspace,['memorial','privatePlan',...(hasPlanning?['planning']:[])],'Workspace');return validateBackup({schemaVersion:hasPlanning?2:1,memorial:workspace.memorial,privatePlan:workspace.privatePlan,...(hasPlanning?{planning:workspace.planning}:{})});}
// Include schema presence: an old memorial-only workspace is not silently replaced by a new empty plan.
function canonical(workspace){return (Object.hasOwn(workspace,'planning')?'planning:':'memorial-only:')+canonicalWorkspace(workspace);}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function createGuidedDraft(workspace){
 const w=normalize(workspace),p=w.planning||createPlanning();
 const draft={fields:{lifecycle:p.lifecycle,jurisdiction:p.jurisdiction,name:w.memorial.name,wishes:p.requirements.wishes||'',story:w.memorial.story,service:w.memorial.service,message:w.memorial.message,...eventDetails(p)},outputs:['organiser'],newTasks:[]};drafts.set(draft,canonical(w));return draft;
}
export function validateGuidedDraft(value){
 record(value,['fields','outputs','newTasks'],'Guided draft');record(value.fields,Object.keys(FIELD_INFO),'Guided fields');
 const fields={};for(const [key,[label,,max]]of Object.entries(FIELD_INFO)){const text=value.fields[key];if(typeof text!=='string'||text.length>max)throw Error(label+' must be bounded text. Current work is unchanged.');fields[key]=text;}
 if(!LIFECYCLES.includes(fields.lifecycle))throw Error('Choose a supported planning context, or Not sure yet.');
 validateEvent(Object.fromEntries(Object.keys(eventDetails()).map(k=>[k,fields[k]])));
 if(!Array.isArray(value.outputs)||value.outputs.length>GUIDED_OUTPUTS.length||new Set(value.outputs).size!==value.outputs.length||value.outputs.some(id=>!GUIDED_OUTPUTS.includes(id)))throw Error('Choose only supported outputs, once each. Current work is unchanged.');
 const newTasks=validateBackup({schemaVersion:1,...blank(),privatePlan:{...blank().privatePlan,tasks:value.newTasks}}).privatePlan.tasks;
 if(newTasks.some(t=>t.status!=='Not started'))throw Error('New guided responsibilities must start as Not started; no completion is inferred.');
 return {fields,outputs:[...value.outputs],newTasks};
}
export function guidedSteps(draft){
 const d=validateGuidedDraft(draft),steps=['context','wishes'];
 if(d.outputs.some(id=>['invitation','runsheet','helper'].includes(id)))steps.push('when','where');
 if(d.outputs.some(id=>['runsheet','program','card'].includes(id)))steps.push('words');
 if(d.outputs.includes('helper')||d.newTasks.length)steps.push('responsibilities');
 return [...steps,'review'];
}
function candidate(workspace,draft){
 const next=clone(workspace),before=createGuidedDraft(workspace).fields,changed=Object.keys(FIELD_INFO).filter(k=>draft.fields[k]!==before[k]);
 for(const key of ['name','story','service','message'])if(changed.includes(key))next.memorial[key]=draft.fields[key];
 const planningKeys=['lifecycle','jurisdiction','wishes'],eventKeys=Object.keys(eventDetails());
 if(changed.some(key=>planningKeys.includes(key)||eventKeys.includes(key))){next.planning=next.planning||createPlanning();for(const key of ['lifecycle','jurisdiction'])if(changed.includes(key))next.planning[key]=draft.fields[key];if(changed.includes('wishes'))next.planning.requirements.wishes=draft.fields.wishes;
  if(changed.some(key=>eventKeys.includes(key)))next.planning=withEventDetails(next.planning,Object.fromEntries(eventKeys.map(key=>[key,draft.fields[key]])));
 }
 next.privatePlan.tasks.push(...clone(draft.newTasks));
 if((changed.length||draft.newTasks.length)&&next.planning)next.planning.revision++;
 return normalize(next);
}
export function prepareGuidedPlan(workspace,value){
 const w=normalize(workspace),draft=validateGuidedDraft(value);
 if(!drafts.has(value))throw Error('Start a fresh guided draft from this workspace before reviewing.');
 if(drafts.get(value)!==canonical(w))throw Error('The workspace changed while this guided draft was open. Start again from the current information.');
 if(draft.newTasks.some(t=>!t.task.trim()))throw Error('Enter a responsibility for every new row, or remove the empty row. Nothing has been applied.');
 const before=createGuidedDraft(w).fields,fields=draft.fields,next=candidate(w,draft);
 const changes=Object.entries(FIELD_INFO).filter(([key])=>before[key]!==fields[key]).map(([key,[label,audience]])=>({key,label,before:before[key],after:fields[key],audience}));
 for(const [i,t]of draft.newTasks.entries())changes.push({key:'new-task-'+i,label:'New private responsibility '+(i+1),before:'',after:'Task: '+t.task+'\nOwner: '+(t.owner||'Not recorded')+'\nStatus: '+t.status,audience:'private — appended; existing tasks unchanged'});
 const summary=[{label:'Planning context',detail:contextLabels[fields.lifecycle]},{label:'Name',detail:fields.name.trim()?fields.name:'Not recorded — you can decide later'},{label:'Wishes',detail:fields.wishes.trim()?fields.wishes:'No wishes recorded; nothing has been assumed'},{label:'Outputs chosen for this visit',detail:draft.outputs.length?draft.outputs.map(id=>outputLabels[id]).join(' · '):'None selected — you can choose an output later'}];
 if(draft.newTasks.length)summary.push({label:'Responsibilities to append',detail:draft.newTasks.length+' new; '+w.privatePlan.tasks.length+' existing kept unchanged. No one is assigned or contacted. Select tasks separately for any helper brief.'});
 if(!draft.outputs.includes('helper')&&draft.newTasks.length)summary.push({label:'Helper brief is not selected',detail:'These new private responsibilities remain included in this review. Return to Responsibilities and remove them if you do not want to apply them.'});
 if(fields.jurisdiction.trim())summary.push({label:'Recorded region',detail:fields.jurisdiction+' — not a verified jurisdictional requirements check'});
 if(fields.service.trim())summary.push({label:'Recorded service sequence',detail:fields.service});
 if(fields.venue.trim()||fields.date.trim()||fields.time.trim())summary.push({label:'Gathering as recorded',detail:[fields.title,fields.date,fields.time,fields.timezone,fields.venue].filter(v=>v.trim()).join(' · ')+' — not a booking confirmation'});
 const unknowns=[],warnings=[];
 if(draft.outputs.includes('helper')&&!next.privatePlan.tasks.length)unknowns.push({label:'For the helper brief: no responsibilities recorded yet',detail:'Return to the Responsibilities step to add tasks now, or leave this open and add them later. Choose tasks separately for the brief. No tasks or helpers will be invented or assigned.'});
 if(draft.outputs.includes('invitation'))for(const key of ['name','date','time','timezone','venue'])if(!fields[key].trim())unknowns.push({label:FIELD_INFO[key][0]+' is not recorded',detail:'The invitation will remain a clearly marked incomplete draft. No missing detail is inferred.'});
 if(draft.outputs.includes('runsheet'))for(const key of ['time','timezone','arrivalTime','lead','service'])if(!fields[key].trim())unknowns.push({label:'For the day sheet: '+FIELD_INFO[key][0].toLowerCase()+' is open',detail:'The working sheet will show what is unknown. No helper, duration or cue is invented.'});
 if(draft.outputs.some(id=>['program','card'].includes(id))&&!fields.name.trim())unknowns.push({label:'For a guest keepsake: name is not recorded',detail:'Review its visible placeholder before downloading. You can return to the words editor later.'});
 if(fields.arrivalTime&&fields.time&&fields.arrivalTime>fields.time)warnings.push('Recorded organiser arrival is later than the event start. Check these times; no date rollover or duration has been assumed.');
 if(changes.some(c=>c.before.trim()))warnings.push('Some recorded information will be replaced or cleared. Check every Before / After value before applying.');
 const lanes=[{label:'The app does',detail:'Prepares editable, reviewed private plans and day sheets, plus separate guest invitations and programmes/cards. The generators use the same facts; no paid AI is needed.'},{label:'Your family can do',detail:'Review the words and permissions, choose helpers, print or send only approved guest copies, and rehearse suitable family-led contributions. A generated file is not a sent invitation or a completed practical task.'},{label:'Physical / official decisions remain',detail:'Confirm the chosen place, access and practical arrangements with the people involved. Physical care, transport, burial or cremation and official processes remain outside this document. Extra paid help is optional where appropriate, not the default.'}];
 const review=freeze({changes,outputs:[...draft.outputs],summary,unknowns,warnings,lanes,hasChanges:changes.length>0});
 reviews.set(review,{baseCanonical:canonical(w),next});return review;
}
export function discardGuidedPlan(review){reviews.delete(review);}
export function approveGuidedPlan(review,current,{consent=false}={}){
 const pending=reviews.get(review);if(!pending)throw Error('No current guided review is ready. Review the plan again.');
 if(consent!==true)throw Error('Review the exact changes and explicitly approve applying this plan.');
 // Consume before validation: a stale/invalid workspace cannot revive an old approval after repair.
 reviews.delete(review);const w=normalize(current);
 if(canonical(w)!==pending.baseCanonical)throw Error('The workspace changed after this guided review. Start again from the current information.');
 return clone(pending.next);
}

// Optional, non-religious sample words, not inferred facts or a prescribed ceremony.
// The caller must separately review insertion and the resulting guided-plan changes.
export const SERVICE_MOMENTS=Object.freeze([
 Object.freeze({id:'welcome',label:'Welcome'}),
 Object.freeze({id:'memories',label:'Invite shared memories'}),
 Object.freeze({id:'reflection',label:'Quiet reflection'}),
 Object.freeze({id:'reading',label:'Introduce a chosen reading'}),
 Object.freeze({id:'music',label:'Introduce chosen music'}),
 Object.freeze({id:'thanks',label:'Closing thanks'})
]);
export function draftServiceWords({name='',moments=[]}={}){
 if(typeof name!=='string'||name.length>200)throw Error('Use a name of at most 200 characters, or leave it blank.');
 if(!Array.isArray(moments)||!moments.length||moments.length>SERVICE_MOMENTS.length||new Set(moments).size!==moments.length||moments.some(id=>!SERVICE_MOMENTS.some(m=>m.id===id)))throw Error('Choose at least one supported service moment, once each.');
 const welcome=name.trim()?`Thank you for coming together to remember ${name.trim()}. Everyone is welcome to take part in the way that feels right for them.`:'Thank you for coming together to remember and reflect. Everyone is welcome to take part in the way that feels right for them.';
 const words={welcome,memories:'We will now make space for memories. Anyone who wishes may share, and listening quietly is equally welcome.',reflection:'Let us take a quiet moment to remember in our own way.',reading:'We will now hear a reading chosen for this gathering.',music:'We will now listen to a piece of music chosen for this gathering.',thanks:'Thank you for being here, for listening, and for sharing this time together.'};
 // Caller order is explicit. No omitted moment, speaker, timing, religion or biography is added.
 return moments.map(id=>SERVICE_MOMENTS.find(m=>m.id===id).label+'\n'+words[id]).join('\n\n');
}

// Assemble only supplied words, in explicit prompt order; no biography or filler is inferred.
export function draftTributeWords(answers){
 const keys=['opening','memory','legacy'];record(answers,keys,'Tribute answers');
 if(keys.some(k=>typeof answers[k]!=='string'||answers[k].length>6000))throw Error('Each tribute answer must be text of at most 6,000 characters.');
 const text=keys.map(k=>answers[k].trim()).filter(Boolean).join('\n\n');
 if(!text)throw Error('Add at least one memory or thought in your own words. You can leave other prompts blank.');
 return text;
}
