import {approvedFirstHoursTaskTexts} from './first-hours-model.js';
// Local, dependency-free document production. No sending, requests, storage or inferred event facts.
import {createPlanning, eventDetails, quoteFromLegacy, quoteSummary, validateQuote,arrangementsDetails,withArrangements,validateArrangements,ARRANGEMENT_LABELS,ARRANGEMENT_STATES,BODY_PRESENCE,costPlanDetails,withCostPlan,moneyMinor,FUNDING_STATES} from './planning-model.js';
import {validateBackup,serializeBackup} from './memorial-backup.js';
import {canonicalWorkspace} from './planning-ai.js';
import {escapeHTML,paragraphHTML} from './memorial-model.js';
import {categories} from './planning-catalog.js';
import {sequenceAssessment,sequencePrivateLines} from './ceremony-sequence-model.js';
export {sequenceAssessment} from './ceremony-sequence-model.js';
import {afterwardAssessment,nextAfterwardAction} from './afterward-model.js';
import {CEREMONY_OUTPUTS} from './ceremony-flow-model.js';
const reviews=new WeakMap(),taskReviews=new WeakMap();
const stateLabels={'not-started':'Not started','in-progress':'In progress',done:'Family marked complete','not-relevant':'Not relevant to this family'};
const clone=value=>JSON.parse(JSON.stringify(value));
export const JOURNEY_PRIORITIES=Object.freeze({bearings:'I am not sure where to begin',decisions:'Work through an open decision',tasks:'Move one responsibility forward',copies:'Make a useful document',day:'Prepare for the gathering',aftercare:'Keep track of afterward questions'});
export const JOURNEY_OUTPUTS=CEREMONY_OUTPUTS;
const unknown=value=>value.trim()||'Not recorded — to confirm';
const categoryTitle=id=>categories.find(c=>c.id===id)?.title||id;
function normalize(w){return validateBackup({schemaVersion:w.planning?2:1,memorial:w.memorial,privatePlan:w.privatePlan,...(w.planning?{planning:w.planning}:{})});}
function asOfDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value.slice(0,10))throw Error('Choose a valid review date.');return value;}
function canonical(w){return canonicalWorkspace(normalize(w));}
export function outputOptions(workspace){
 const w=normalize(workspace),p=w.planning||createPlanning();
 return {tasks:w.privatePlan.tasks.map((t,i)=>({id:'task-'+i,label:t.task||'Untitled task',detail:[t.status,t.owner||'Owner not recorded'].join(' · ')})),requirements:Object.entries(p.requirements).filter(([,v])=>v.trim()).map(([id,v])=>({id,label:categoryTitle(id),detail:v})),customNeeds:p.customNeeds.map(n=>({id:n.id,label:n.title||'Untitled custom need',detail:n.notes||stateLabels[n.status]})),quotes:w.privatePlan.quotes.map((q,i)=>({id:'quote-'+i,label:[q.supplier||'Supplier not recorded',q.item||'Item not recorded'].join(' · '),detail:'Manually entered, unverified. Amount: '+(q.amount.trim()||'unknown')}))};
}
// Private, transient row capabilities over canonical tasks; no separate task store.
export function prioritizeUnfinishedTasks(tasks){
 const rank=t=>t.status==='In progress'?0:!t.owner.trim()?1:2;
 return tasks.map((task,index)=>({task,index})).filter(x=>x.task.status!=='Done').sort((a,b)=>rank(a.task)-rank(b.task)||a.index-b.index).map(x=>x.task);
}
export function taskFollowThrough(workspace){
 const w=normalize(workspace),snapshot=canonical(w);
 const rows=w.privatePlan.tasks.map((task,index)=>{const row=Object.freeze({index,...task});taskReviews.set(row,snapshot);return row;});
 const open=prioritizeUnfinishedTasks(rows);
 return {open,done:rows.filter(t=>t.status==='Done'),unowned:open.filter(t=>!t.owner.trim()).length};
}
export function updateFollowThroughTask(workspace,row,changes){
 if(!taskReviews.has(row)||taskReviews.get(row)!==canonical(workspace))throw Error('The task list changed. Review the current row before updating it.');
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).sort().join(',')!=='owner,status')throw Error('Update only the recorded owner and status.');
 const next=normalize(workspace),current=next.privatePlan.tasks[row.index];
 if(!current||current.task!==row.task||current.owner!==row.owner||current.status!==row.status)throw Error('The task changed. Review the current row before updating it.');
 next.privatePlan.tasks[row.index]={...current,owner:changes.owner,status:changes.status};
 const tasks=normalize(next).privatePlan.tasks;taskReviews.delete(row);return tasks;
}
export function reviewPlan(workspace,{asOf=new Date().toISOString()}={}){
 const w=normalize(workspace),p=w.planning||createPlanning(),event=eventDetails(p),decisions=[],unknowns=[],actions=[];asOfDate(asOf);
 for(const [id,state] of Object.entries(p.categoryStates))if(state!=='not-started')decisions.push({label:categoryTitle(id),detail:stateLabels[state]+' — a family record, not a verified legal or service confirmation.',route:'plan/'+id});
 for(const [id,note] of Object.entries(p.requirements))if(note.trim())decisions.push({label:categoryTitle(id)+' note',detail:'A private note is recorded. Review it before including it in your pack.',route:'plan/'+id});
 for(const n of p.customNeeds)if(n.title.trim()||n.notes.trim())decisions.push({label:n.title||'Custom need',detail:stateLabels[n.status],route:'plan/custom'});
 for(const t of w.privatePlan.tasks)if(t.task.trim())decisions.push({label:t.task,detail:t.status+(t.owner.trim()?' · '+t.owner:' · Owner not recorded'),route:'tasks'});
 for(const [key,label] of [['title','Event title'],['date','Event date'],['time','Event start time'],['timezone','Time zone'],['venue','Venue'],['lead','Day-of lead']]){
  if(event[key].trim())decisions.push({label,detail:event[key],route:'outcomes/event'});else unknowns.push({label:(key==='lead'?'For a run sheet: ':'For an invitation: ')+label.toLowerCase()+' not recorded',detail:'This is not a required planning step. Add it only if you want this output; no date, booking or person is assumed.',route:'outcomes/event'});
 }
 if(!w.memorial.name.trim())unknowns.push({label:'For guest documents: name not recorded',detail:'You can keep a placeholder, or add the name in Words & life story.',route:'words'});
 const unassigned=w.privatePlan.tasks.filter(t=>t.task.trim()&&t.status!=='Done'&&!t.owner.trim()).length;
 if(unassigned)unknowns.push({label:unassigned+' open task'+(unassigned===1?' has':'s have')+' no recorded owner',detail:'Choose a helper only if useful. The app has not assigned or contacted anyone.',route:'tasks'});
 if(w.privatePlan.quotes.length){const qs=quoteSummary(w.privatePlan.quotes.map((q,i)=>quoteFromLegacy(q,i,p.jurisdiction)),asOf),missing=qs.reduce((n,q)=>n+q.unknown,0);unknowns.push({label:'Quote scope, expiry and availability are unverified',detail:(missing?missing+' amount'+(missing===1?' is':'s are')+' unknown. ':'')+'Date / validity notes are not parsed. Known amounts are not current all-in prices or spending commitments.',route:'costs'});}
 const costs=costChoiceAssessment(w);if(costs.recorded){decisions.push({label:'Working cost choice and funding',detail:costs.stale?'Earlier choice is stale. Rechoose against current records; no current subtotal or available-funds claim.':(costs.knownMinor===null?'No cost rows selected; total unknown.':'Known selected-row subtotal AUD '+(costs.knownMinor/100).toFixed(2)+'; '+costs.unknownCount+' unknown amount(s), before unrecorded or overlapping charges.')+' Funding: '+FUNDING_STATES[costs.funding]+'. Not a contract, payment or affordability finding.',route:'outcomes/costs'});if(costs.stale)unknowns.push({label:'Working cost choice needs fresh review',detail:'Selected quotes or person/event/budget context changed. Earlier snapshots are historical only.',route:'outcomes/costs'});}
 const sequence=sequenceAssessment(w);if(sequence.recorded){decisions.push({label:'Recorded ceremony sequence',detail:sequence.stale?'Earlier cues are stale after changed words or context. Rebuild and review before use.':sequence.items.length+' recorded moment(s). Private operator play-through and cue-sheet selection are available; nothing is marked rehearsed.',route:'sequence'});if(sequence.stale)unknowns.push({label:'Ceremony cues need fresh review',detail:'Current service words remain available for guest drafts, but earlier private cues cannot run or enter a current cue sheet.',route:'sequence'});}
 const afterward=afterwardAssessment(w);if(afterward.recorded)decisions.push({label:'Chosen afterward handover',detail:afterward.open.length+' open chosen action(s). Family-reported waiting/completion only; no organisation is notified or account closed.',route:'afterward'});
 if(p.proposals.some(x=>x.status==='pending'))unknowns.push({label:'Proposed tasks still need a decision',detail:'Pending proposals are not included as agreed tasks in your pack.',route:'plan/review'});
 actions.push({label:'Make a helper brief',detail:'Select just the responsibilities a helper needs, review their text and owners, then download a separate limited-sharing copy. Nothing is assigned or sent.',route:'outcomes/helper'},{label:'Make my pack',detail:'Choose recorded private items, review the complete document, then approve its download.',route:'outcomes/pack'},{label:'Make an invitation / announcement',detail:'Create a separate guest-facing draft from the event details you choose to share. Nothing is sent.',route:'outcomes/invitation'},{label:'Make a day-of run sheet',detail:'Use recorded arrival, start time, service order and selected tasks. Unknown facts stay visible.',route:'outcomes/runsheet'},{label:'Make a programme or card',detail:'Use only the existing approved guest words and portrait.',route:'keepsake'});
 return {event,decisions,unknowns,actions,counts:{tasks:w.privatePlan.tasks.length,openTasks:w.privatePlan.tasks.filter(t=>t.status!=='Done').length,notes:Object.values(p.requirements).filter(v=>v.trim()).length+p.customNeeds.filter(n=>n.notes.trim()).length,quoteRows:w.privatePlan.quotes.length},revision:p.revision,asOf};
}
export function quoteAssessment(quote,asOf=new Date().toISOString()){
 asOfDate(asOf);const q=validateQuote(quote),summary=quoteSummary([q],asOf)[0],now=Date.parse(asOf);
 const expired=[q.validUntil,...q.sourceRefs.map(s=>s.validUntil)].some(v=>v&&Date.parse(v)<now);
 const future=[q.issuedAt,q.retrievedAt,...q.sourceRefs.flatMap(s=>[s.observedAt,s.publishedAt])].some(v=>v&&Date.parse(v)>now);
 return {...summary,expired,futureEvidence:future,notice:expired?'Expired quote or source: historical known subtotal only, not a current price.':future?'Future-dated evidence: not a current verified price.':'Manually reviewed facts still need matching scope, availability and terms. A known subtotal is not a spending commitment.'};
}
function select(w,selection={}){
 const options=outputOptions(w),keys=['tasks','requirements','customNeeds','quotes'];
 if(!selection||typeof selection!=='object'||Array.isArray(selection)||Object.keys(selection).some(k=>![...keys,'includeBudget','includeArrangements','includeCostPlan','includeSequence'].includes(k)))throw Error('Choose only supported private pack items.');
 const result={includeSequence:selection.includeSequence??false,includeCostPlan:selection.includeCostPlan??false,includeBudget:selection.includeBudget??false,includeArrangements:selection.includeArrangements??false};if(typeof result.includeSequence!=='boolean')throw Error('Choose whether to include private ceremony cues.');if(typeof result.includeCostPlan!=='boolean')throw Error('Choose whether to include the private cost choice.');if(typeof result.includeArrangements!=='boolean')throw Error('Choose whether to include private arrangement checks.');if(typeof result.includeBudget!=='boolean')throw Error('Choose whether to include the private budget.');
 for(const key of keys){const ids=selection[key]??[];if(!Array.isArray(ids)||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!options[key].some(v=>v.id===id)))throw Error('A selected item no longer exists. Review your selections again.');result[key]=ids;}
 return result;
}
function eventLines(event,{guest=false}={}){const pairs=[['Event',event.title],['Date',event.date],['Start time',event.time],['Time zone',event.timezone],['Venue',event.venue],['Address',event.address]];if(!guest)pairs.push(['Organiser arrival time',event.arrivalTime],['Day-of lead',event.lead]);pairs.push(['Guest RSVP / contact',event.contact],['Guest information',event.guestInfo]);return pairs.map(([label,value])=>label+': '+unknown(value));}
function doc(title,kicker,sections,footer){
 const e=escapeHTML,text=[kicker,title,...sections.flatMap(s=>[s.title,...s.lines]),footer].join('\n\n');
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+e(title)+'</title><style>body{max-width:760px;margin:36px auto;padding:24px;color:#203d35;background:white;font:17px/1.55 system-ui,sans-serif}header{border-bottom:2px solid #234f46;padding-bottom:20px}h1,h2{overflow-wrap:anywhere}h1{font:36px/1.15 Georgia,serif}h2{font-size:21px;margin-top:30px}p{white-space:pre-wrap;overflow-wrap:anywhere;page-break-inside:avoid;break-inside:avoid}p.flowing{page-break-inside:auto;break-inside:auto}header p{font-size:13px;font-weight:700;letter-spacing:.05em}section{border-bottom:1px solid #ccd7d1;padding-bottom:12px}footer{font-size:12px;margin-top:32px;white-space:pre-wrap}h2{page-break-after:avoid;break-after:avoid}@media print{body{max-width:none;margin:0;padding:10mm}p{orphans:3;widows:3}}</style></head><body><header><p>'+e(kicker)+'</p><h1>'+e(title)+'</h1></header>'+sections.map(s=>'<section><h2>'+e(s.title)+'</h2>'+s.lines.map(paragraphHTML).join('')+'</section>').join('')+'<footer>'+e(footer)+'</footer></body></html>';
 return {html,text};
}
export function prepareOutput(workspace,{kind,selection={},asOf=new Date().toISOString()}={}){
 if(!['organiser','invitation','runsheet','helper','quote-enquiry'].includes(kind))throw Error('Choose a supported document.');
 const w=normalize(workspace),p=w.planning||createPlanning(),event=eventDetails(p),chosen=select(w,selection),arrangements=arrangementAssessment(w),sections=[],warnings=[];asOfDate(asOf);
 const name=w.memorial.name.trim()||'Name not recorded';const missing=['date','time','timezone','venue'].filter(k=>!event[k].trim());if(!w.memorial.name.trim())missing.push('name');
 const add=(title,lines)=>sections.push({title,lines});let title,kicker,filename;
 if(kind==='quote-enquiry'){
  if(chosen.tasks.length||chosen.requirements.length||chosen.customNeeds.length||chosen.includeBudget||chosen.includeArrangements||chosen.includeCostPlan||chosen.includeSequence)throw Error('Quote questions allow one entered cost row only, not other private records.');
  if(chosen.quotes.length!==1)throw Error('Choose exactly one current entered cost row. Nothing is selected automatically.');
  const q=w.privatePlan.quotes[Number(chosen.quotes[0].slice(6))],amount=moneyMinor(q.amount);
  title='Questions about an entered cost row';kicker='UNSENT QUESTION DRAFT — REVIEW SELECTED LABELS BEFORE SHARING';filename='PRIVATE-quote-questions-draft.html';
  add('Selected entered row — unverified',['Supplier label: '+unknown(q.supplier),'Item label: '+unknown(q.item),'Entered numeric amount: '+(amount===null?'Unknown — not zero. No recognised numeric amount was recorded.':(amount/100).toFixed(2)+' — currency and tax not established.'),'This row may be an estimate, item or overlapping part of a package, not a received or current offer. No availability, price, booking or obligation is established.']);
  add('Questions to adapt before asking',['Could you provide a current written, itemised quote for the service or item described above, in your quoted currency?',
   'What is included and excluded? Which items are optional, and what choices are available without them?',
   'Are any of these costs already bundled with, or duplicated by, another line or package? Please separate alternatives from genuinely additional charges.',
   'What is the full price for the agreed scope, including applicable tax, fees and any conditional or additional charges? What circumstances could change it?',
   'How long would the written quote remain valid, and how would we check availability for any proposed arrangements before relying on them?',
   'Who would be agreeing to payment, when would payments be due, and what deposit, change, cancellation or refund terms would apply?',
   'What information would you need to clarify this request, and what secure method should we use if sensitive information is necessary?']);
  add('Before sharing',['Check that the selected supplier and item labels are correct and remove or correct any sensitive wording in those original rows before making a fresh draft. The app copies those labels as entered; this draft is not guaranteed anonymous.',
   'Only the selected labels and a recognised numeric amount are copied. No other workspace facts or private scope, source, date or terms notes are inserted. Questions stay present even when private notes exist, because those notes are not verified answers.',
   'Choose only the questions relevant to your situation. These are questions, not legal advice, required purchases or promises about a supplier’s duties. Nothing is sent, accepted or paid.']);
  warnings.push('Selected supplier and item labels will be copied and can contain personal information. Review the exact draft before manual sharing. No recipient is verified or contacted.');
 }else if(kind==='invitation'){
  if(Object.values(chosen).some(v=>Array.isArray(v)?v.length:v))throw Error('Private selections are not allowed in a guest invitation.');
  title=event.title.trim()||'A gathering to remember';kicker=missing.length?'DETAILS INCOMPLETE — DRAFT FOR FAMILY REVIEW':'INVITATION / ANNOUNCEMENT — FOR FAMILY REVIEW';filename='GUEST-invitation-draft.html';
  add('Remembering '+name,eventLines(event,{guest:true}));
  if(arrangements.provisional){if(!missing.length)kicker='PROVISIONAL ARRANGEMENTS — INVITATION DRAFT FOR FAMILY REVIEW';const notice='These gathering details remain provisional. Please check with the organiser before relying on the date, place or arrangements.';warnings.push(notice);add('Provisional planning details',[notice]);}
  if(missing.length){const incompleteWarning='Details incomplete: '+missing.join(', ')+'. No missing fact was inferred.';warnings.push(incompleteWarning);add('Before sharing',[incompleteWarning,'Please confirm the details and intended audience. This is a draft, not a booking or a sent invitation.']);}else add('Before sharing',['Please confirm these details and the intended audience with the family. The app has not verified a booking or sent this invitation.']);
 }else if(kind==='helper'){
  if(chosen.requirements.length||chosen.customNeeds.length||chosen.quotes.length||chosen.includeBudget||chosen.includeArrangements||chosen.includeCostPlan||chosen.includeSequence)throw Error('Helper briefs allow selected tasks only, not private notes, quotes or budget.');
  if(!chosen.tasks.length)throw Error('Choose at least one task for this helper brief. Nothing is selected automatically.');
  title='Helper task brief';kicker='LIMITED SHARING — SELECTED HELPER ONLY — REVIEW BEFORE SHARING';filename='HELPER-task-brief.html';
  add('Helping remember '+name,['Prepared as of: '+asOf,'Share only with the intended helper after checking every selected task and owner. These words come from private tasks and may contain sensitive information.']);
  add('Gathering details — as recorded',eventLines(event,{guest:true}));
  if(arrangements.provisional){const notice='These gathering details remain provisional. Please check with the organiser before relying on the date, place or arrangements.';warnings.push(notice);add('Provisional planning details',[notice]);}
  const rows=chosen.tasks.map(id=>w.privatePlan.tasks[Number(id.slice(5))]);
  add('Selected responsibilities',rows.map(t=>'Task: '+unknown(t.task)+'\nRecorded status: '+t.status+'\nRecorded owner: '+unknown(t.owner)));
  const open=rows.filter(t=>t.status!=='Done'&&!t.owner.trim());
  if(open.length)add('Still to agree',open.map(t=>'Agree who will handle: '+unknown(t.task)));
  add('Before the helper acts',['Please confirm these responsibilities and practical details together. A recorded owner or status is not proof that someone has accepted a task or completed it.','No task deadline, arrival time or extra instruction has been inferred. Event start is not a task deadline.','This brief does not assign tasks, contact anyone, confirm a booking or perform official steps. Generate a fresh brief after changes.']);
  warnings.push('Selected task text and recorded owners will leave the private plan in this file. Check permission and share only with the intended helper.');
  if(missing.length)warnings.push('Gathering details incomplete: '+missing.join(', ')+'. Confirm what is relevant before use.');
 }else{
  title=kind==='runsheet'?'Day-of run sheet':'Organiser working plan';kicker='PRIVATE — ORGANISER COPY — NOT FOR GUESTS';filename=kind==='runsheet'?'PRIVATE-day-of-run-sheet.html':'PRIVATE-organiser-plan.html';
  add('Working copy for '+name,['Content revision: '+p.revision,'Prepared as of: '+asOf,'This is a working document from family-entered information, not verified legal compliance, a confirmed booking or a complete list of obligations. Use only the areas that are relevant.']);
  add('Recorded event details',eventLines(event));
  const unresolved=[];for(const key of ['date','time','timezone','venue','arrivalTime','lead'])if(!event[key].trim())unresolved.push(({date:'Event date',time:'Start time',timezone:'Time zone',venue:'Venue',arrivalTime:'Arrival time',lead:'Day-of lead'})[key]+': not recorded — confirm if relevant.');
  if(kind==='runsheet'){
   add('Day-of sequence',['Organiser arrival: '+unknown(event.arrivalTime)+' · Person: '+unknown(event.lead),'Event start: '+unknown(event.time)+' · Time zone: '+unknown(event.timezone),'No travel duration, finish time, speaker assignment or additional schedule has been inferred.']);
   add('Order of service — as recorded',[w.memorial.service.trim()||'No order of service recorded. Add the sequence in Remember → Order of service; timing is not inferred.']);
  }
  if(chosen.tasks.length){const rows=chosen.tasks.map(id=>w.privatePlan.tasks[Number(id.slice(5))]);add('Selected private tasks',rows.map(t=>'Task: '+unknown(t.task)+'\nStatus: '+t.status+'\nOwner: '+unknown(t.owner)));for(const t of rows)if(t.status!=='Done'&&!t.owner.trim())unresolved.push('Selected task has no owner: '+unknown(t.task));}
  if(chosen.requirements.length)add('Selected private notes',chosen.requirements.map(id=>categoryTitle(id)+'\nFamily status: '+stateLabels[p.categoryStates[id]||'not-started']+'\n'+p.requirements[id]));
  if(chosen.customNeeds.length)add('Selected custom needs',chosen.customNeeds.map(id=>{const n=p.customNeeds.find(v=>v.id===id);return unknown(n.title)+'\nFamily status: '+stateLabels[n.status]+'\n'+(n.notes||'No note recorded.');}));
  if(chosen.includeArrangements){
   if(!arrangements.recorded)throw Error('Record arrangement checks before choosing to include them.');
   add('Selected private arrangement checks',['For this one recorded event: '+BODY_PRESENCE[arrangements.bodyPresence],'Family-reported planning records only. Not legal authority, provider confirmation or permission. Not-part-of-plan labels do not waive outside requirements.',...arrangements.rows.map(r=>r.label+': '+ARRANGEMENT_STATES[r.state]+(r.stale?' — STALE after changed context; recheck before relying on this report.':'')+(r.id==='release'&&arrangements.bodyPresence!=='yes'?' — not used as a body-availability dependency for this event.':''))]);
  }
  if(arrangements.provisional)unresolved.push('Relevant event-arrangement checks remain provisional. Review them in the private workspace; no booking or official confirmation is established by this document.');
  if(chosen.includeSequence){add('Selected private ceremony sequence',sequencePrivateLines(w));warnings.push('Private ceremony owners, cues and fallbacks are included. This copy is not for guests.');}
  if(chosen.includeCostPlan){if(kind!=='organiser')throw Error('The private cost choice is only available in the organiser pack.');if(!costChoiceAssessment(w).recorded)throw Error('Record a working cost choice before selecting it.');add('Selected private cost choice and funding',costChoiceLines(w));warnings.push('The private cost choice includes selected quote snapshots, budget target and family-reported funding; share only with the intended organiser.');if(costChoiceAssessment(w).plan.comparison)warnings.push('It also includes the earlier Option '+costChoiceAssessment(w).plan.comparison.option+' included-item dependency snapshots and private inclusion assumptions; these amounts are not added.');}
  if(chosen.includeBudget)add('Private budget',[unknown(w.privatePlan.budget),'This is the family’s recorded starting figure, not a spending commitment.']);
  if(chosen.quotes.length){const rows=chosen.quotes.map(id=>w.privatePlan.quotes[Number(id.slice(6))]);add('Selected quote facts — unverified',rows.map((q,i)=>{const assessment=quoteAssessment(quoteFromLegacy(q,i,p.jurisdiction),asOf);return ['Supplier: '+unknown(q.supplier),'Item: '+unknown(q.item),'Entered amount: '+(q.amount.trim()||'Unknown — not zero'),'Known subtotal for this one row: '+assessment.currency+' '+(assessment.knownMinor/100).toFixed(2)+(assessment.unknown?' (amount unknown; this subtotal excludes it)':''),'Scope: '+unknown(q.scope),'Source note: '+unknown(q.source),'Date / validity note (not parsed): '+unknown(q.date),'Terms: '+unknown(q.terms),'Current all-in price: unknown. Expiry, tax, availability and scope are unverified. No booking or purchase is recorded by this export.'].join('\n');}));unresolved.push('Selected quotes: confirm expiry, scope, tax, availability, exclusions and terms directly if you choose to use them. Alternative suppliers are not added together.');warnings.push('Selected quote amounts remain unverified; no current all-in total is claimed.');}
  if(!chosen.tasks.length&&!chosen.requirements.length&&!chosen.customNeeds.length&&!chosen.quotes.length&&!chosen.includeBudget&&!chosen.includeArrangements&&!chosen.includeCostPlan&&!chosen.includeSequence)warnings.push('No private tasks, notes, quotes or budget selected. This copy includes event details'+(kind==='runsheet'?' and recorded service order':'')+' only.');
  if(unresolved.length)add('Facts still unresolved in this copy',unresolved);else add('Review before use',['Recorded fields alone do not establish that arrangements are complete or confirmed. Check this working copy with the people involved.']);
  add('Useful next steps',['Use the app to revise the event details, private tasks or words, then generate a fresh copy after changes.','Use the separate guest invitation or keepsake flow for anything intended for attendees. This private file may contain personal notes, costs and task owners.','The family chooses who does practical work. Physical care, transport and any locally regulated or official step must be handled by the appropriate people; this document does not perform or verify them.']);
 }
 const footer=(kind==='quote-enquiry'?'PRIVATE unencrypted question draft. Only the selected row labels and recognised numeric amount are copied, not the rest of the private plan. ':kind==='helper'?'LIMITED-SHARING unencrypted helper copy. Includes only the name, guest event details'+(arrangements.provisional?', any generic provisional-planning notice':'')+' and explicitly selected task text, status and owners. No other private records are included. ':kind==='invitation'?'Guest-facing draft; only the name, explicit guest event fields and any generic provisional-planning notice are included. ':'PRIVATE unencrypted working copy. Keep it somewhere you control; do not use it as an attendee keepsake. ')+'Nothing has been sent, booked, paid, uploaded or published. Open this self-contained file in a browser to Print / Save as PDF. Pagination has not been verified.';
 const result=Object.freeze({kind,title,...doc(title,kicker,sections,footer),warnings:Object.freeze(warnings),filename});reviews.set(result,{canonical:canonical(w),result});return result;
}
export function discardOutput(review){reviews.delete(review);}
export function approveOutput(review,current,{consent=false}={}){
 const pending=reviews.get(review);if(!pending)throw Error('No current output review is ready. Make and review a fresh copy.');
 if(consent!==true)throw Error('Review the complete document and explicitly approve this download.');
 reviews.delete(review);
 if(canonical(current)!==pending.canonical)throw Error('The workspace changed after preview. Make and review a fresh copy.');
 return {html:pending.result.html,text:pending.result.text,filename:pending.result.filename};
}

// One explainable, optional next action over current facts. This does not record
// priority, infer urgency, change tasks, verify arrangements, or mark readiness.
export function journeyChoices(workspace){
 const w=normalize(workspace),p=w.planning||createPlanning();
 const areas=categories.filter(c=>!['done','not-relevant'].includes(p.categoryStates[c.id])&&(p.categoryStates[c.id]==='in-progress'||p.requirements[c.id]?.trim())).map(c=>({id:c.id,label:c.title,route:'plan/'+c.id,rank:p.categoryStates[c.id]==='in-progress'?0:1}));
 const custom=p.customNeeds.filter(n=>!['done','not-relevant'].includes(n.status)&&(n.status==='in-progress'||n.title.trim()||n.notes.trim())).map(n=>({id:'custom:'+n.id,label:n.title.trim()||'Untitled custom need',route:'plan/custom',rank:n.status==='in-progress'?0:1}));
 const costs=costChoiceAssessment(w),costChoice=costs.recorded?[{id:'working-costs',label:'Working cost choice and funding',route:'outcomes/costs',rank:1}]:[];
 const seq=sequenceAssessment(w),sequenceChoice=seq.recorded?[{id:'ceremony-sequence',label:'Recorded ceremony sequence',route:'sequence',rank:1}]:[];
 return [...areas,...custom,...costChoice,...sequenceChoice].sort((a,b)=>a.rank-b.rank).map(({rank,...choice})=>choice);
}
export function nextPlanningStep(workspace,{priority='',output='',decision=''}={},flow={receipts:[]}){
 const w=normalize(workspace),p=w.planning||createPlanning(),event=eventDetails(p);
 if(priority&&!Object.hasOwn(JOURNEY_PRIORITIES,priority))throw Error('Choose one of the available priorities.');
 if(output&&!Object.hasOwn(CEREMONY_OUTPUTS,output))throw Error('Choose an available document.');
 if(decision&&decision!=='working-costs'&&decision!=='ceremony-sequence'&&!categories.some(c=>c.id===decision)&&!/^custom:[a-zA-Z0-9_-]{1,80}$/.test(decision))throw Error('Choose a recorded planning decision.');
 if(!priority)return null;
 const has=v=>typeof v==='string'&&!!v.trim(),open=prioritizeUnfinishedTasks(w.privatePlan.tasks),pending=p.proposals.some(v=>v.status==='pending');
 const receipts=Array.isArray(flow?.receipts)?flow.receipts.filter(r=>Object.hasOwn(CEREMONY_OUTPUTS,r.kind)):[];
 const step=(title,detail,why,label,route,extra={})=>({title,detail,why,label,route,...extra});
 const taskStep=(t=open[0])=>{return step(has(t.task)?t.task:'Give your unfinished task a description',has(t.task)?(has(t.owner)?'Recorded owner: '+t.owner+'. Confirm their agreement separately.':'No owner is recorded. Choose who can help, or keep it with you for now.'):'An empty task row is recorded; it cannot tell you what to do yet.',t.status==='In progress'?'This task is marked In progress. The app does not infer deadlines or urgency.':!has(t.owner)?'This is the next unfinished task without a recorded owner. It is a suggestion, not a required funeral step.':'This is the next unfinished task in your recorded list.','Review / update this task','outcomes');};
 const pendingStep=()=>step('Decide whether to apply the proposed change','Review the exact change, then approve or reject. A proposal is not an agreed decision or responsibility.','Your recorded plan contains a pending proposal.','Review proposed changes','plan/review');
 const decisionStep=()=>{
  const choices=journeyChoices(w),chosen=choices.find(c=>c.id===decision)||choices[0];
  if(chosen?.id==='ceremony-sequence'){const a=sequenceAssessment(w);return step(a.stale?'Recheck the changed ceremony sequence':'Try the private operator play-through',a.stale?'Current words or person/event context changed. Review the current service and private handoffs before using old cues.':'Move through the recorded moments with Next/Back, pause and explicit handoff notes. This is a private operator screen, not a guest projection or media player.','You explicitly recorded a sequence. A play-through does not certify a rehearsal or complete the ceremony.','Open the ceremony sequence','sequence',{decisionId:chosen.id});}
  if(chosen?.id==='working-costs'){const a=costChoiceAssessment(w);return step(a.stale?'Recheck the changed cost choice':'Review costs and funding before commitments',a.stale?'Earlier selected quote snapshots no longer match the current plan. Choose from the current rows and recheck funding; nothing has been bought or paid.':'Compare the selected rows, unknown or overlapping charges, and when money is available. A family report of some funds is not proof of sufficiency or eligibility.','You explicitly recorded a private working cost choice. Reviewing it is optional; no service or purchase is required by the app.','Review the working cost choice','outcomes/costs',{decisionId:chosen.id});}
  if(chosen)return step('Return to '+chosen.label.toLowerCase(),'Review your recorded questions. Note what is still undecided; use the existing task proposal if someone needs to follow it up. Mark progress only as your own family record.','This area has an open recorded note or is marked In progress. Other areas are not assumed necessary.','Open this decision',chosen.route,{decisionId:chosen.id});
  if(!['done','not-relevant'].includes(p.categoryStates.wishes))return step('Write one thing that matters to your family','A preference, a question or someone to consult is enough. You do not have to choose a service or buy anything.','No open planning decision is recorded. Start with your own wishes rather than an assumed checklist.','Record one wish or question','plan/wishes');
  return step('Choose the question that matters now','No other open decision with notes or In progress status is recorded. Completed or not-relevant statuses are family records, not proof that arrangements are complete. Add another area only if useful.','There is no other open recorded decision to prioritise.','Choose a relevant planning area','plan');
 };
 const outputStep=kind=>{
  const meta=CEREMONY_OUTPUTS[kind],receipt=receipts.find(r=>r.kind===kind),direct={label:'Review this copy as a draft instead',route:meta.route,outputKind:kind};
  if(receipt&&!receipt.current)return step('Refresh your '+meta.label.toLowerCase(),'The workspace changed after its download request. Make a fresh preview and approve a new copy; earlier files are not updated or recalled.','This session records an older-workspace download request for the copy you chose.','Review a fresh copy',meta.route,{outputKind:kind});
  if(receipt?.current)return step('Open the actual '+meta.label.toLowerCase()+' file','A download request is recorded, not proof that the file was saved. Open it separately, check the content and page breaks, then rehearse the relevant fallback.','The chosen copy was requested from the current workspace in this session.','Check saved copies and fallback','rehearse');
  if(kind==='helper'&&!w.privatePlan.tasks.length)return step('Record one responsibility for the helper','A helper brief needs at least one task. Add only what you want that person to see; no one is assigned or contacted.','There are no recorded tasks to select for this brief.','Add a responsibility','tasks');
  if(['program','card','invitation'].includes(kind)&&!has(w.memorial.name))return step('Choose the name or heading for this copy','Leave it blank if you are not ready. You can still preview a clearly incomplete draft; no name or date is inferred.','The chosen guest copy has no recorded name or heading.','Review the guest words','words',{alternative:direct});
  const eventKeys=kind==='invitation'?['date','time','timezone','venue']:kind==='runsheet'?['date','time','timezone','venue','lead']:[];
  const labels={date:'date',time:'start time',timezone:'time zone',venue:'place',lead:'day-of lead'},missing=eventKeys.filter(k=>!has(event[k]));
  if(missing.length)return step('Review the details for your '+meta.label.toLowerCase(),'Not recorded: '+missing.map(k=>labels[k]).join(', ')+'. Add only what you know. These are output-specific gaps, not required funeral steps or confirmed bookings.','You chose this copy; its missing details will otherwise remain visible as unknown.','Review event details','outcomes/event',{alternative:direct});
  if(['program','runsheet'].includes(kind)&&!has(w.memorial.service))return step('Shape the service words, if you want them','Record your own sequence, speakers, readings or music cues. No timing, belief or contributor is invented. You may leave this blank.','The chosen copy uses the order of service, which is not recorded.','Write the service sequence','service',{alternative:direct});
  return step('Review your '+meta.label.toLowerCase(),kind==='organiser'?'Choose exactly which private notes, tasks or quote rows to include. An organiser pack is not a guest copy.':kind==='helper'?'Select only the tasks this helper should see, then review every word and recorded owner.':'Review this copy and its intended audience. Approve the exact preview only when you are ready.','You chose this document. Recorded facts are not independently verified; nothing will be sent.','Open this document tool',meta.route,{outputKind:kind});
 };
 if(priority==='copies')return output?outputStep(output):step('Choose one useful copy','You do not need to create every document. Guest copies and private working records have different audiences.','No document has been chosen in this next-step view yet.','Choose a document below',null,{chooseOutput:true});
 if(priority==='tasks')return open.length?taskStep():pending?pendingStep():step('Record one practical responsibility','Write a task you actually want to do or ask someone about. Leave the owner unknown if needed.','No unfinished recorded task is available. Marked-Done tasks do not prove arrangements are complete.','Add or review responsibilities','tasks');
 if(priority==='decisions')return decisionStep();
 if(priority==='day'){
  const checks=arrangementAssessment(w);
  if(checks.recorded&&!checks.eventChosen)return step('No gathering is currently chosen','You can keep a private plan or work on aftercare without creating ceremony documents. Choose a different priority if your plans change.','Your arrangement worksheet records no event; the app does not require one.','Review the arrangement worksheet','outcomes/arrangements',{alternative:{label:'Review aftercare questions instead',route:'afterward'}});
  if(checks.provisional)return step('Recheck the relevant gathering arrangements','Some event-scoped planning checks are unknown, open or stale. You can keep drafting; no private detail is added to guest copies.','Your optional worksheet distinguishes a recorded date from family-reported confirmation.','Review arrangement checks','outcomes/arrangements',{alternative:{label:'Continue to rehearsal prompts anyway',route:'rehearse'}});
  const sequence=sequenceAssessment(w);if(sequence.stale)return step('Recheck the changed ceremony sequence','Earlier private cues no longer match the current words or person/event context. Keep drafting guest words, but review before operating or exporting those cues.','A recorded sequence became stale; this is not a mandatory ceremony requirement.','Review the ceremony sequence','sequence',{alternative:{label:'Review saved-file checks instead',route:'rehearse'}});
  const stale=receipts.find(r=>!r.current);if(stale)return outputStep(stale.kind);
  if(open.length)return {...taskStep(),alternative:{label:'Check copies and rehearsal instead',route:'rehearse'}};
  if(pending)return pendingStep();
  const missing=['date','time','timezone','venue','lead'].filter(k=>!has(event[k]));
  if(missing.length)return step('Check the gathering details and who will lead','Some event or lead details are still unrecorded. Add them only if relevant, and confirm them with the people involved.','This is a practical handover check, not confirmation of a booking or official requirement.','Review the gathering details','outcomes/event',{alternative:{label:'Go to the rehearsal view anyway',route:'rehearse'}});
  return receipts.length?step('Check the copies and practise the fallback','Open the actual files, check the paper copy and agree the handoffs. A local silent montage can be made separately, but the app cannot verify your saved file, playback device or venue.','Recorded tasks and download requests cannot establish that the day is ready.','Open the rehearsal view','rehearse'):step('Make one working copy for the day, if useful','A private day sheet can collect your recorded event details, service sequence and selected tasks. Its own review and approval are still required.','No download request is recorded in this session. Copies made in another session may still exist.','Review a private day sheet','outcomes/runsheet',{outputKind:'runsheet',alternative:{label:'I already have my files — review the fallback',route:'rehearse'}});
 }
 if(priority==='aftercare'||priority==='bearings'&&p.lifecycle==='aftercare'){const action=nextAfterwardAction(w);return {...action,alternative:{label:'Review existing practical tasks instead',route:'outcomes'}};}
 const firstHoursTexts=approvedFirstHoursTaskTexts(w),chosenFirstHours=open.find(t=>firstHoursTexts.includes(t.task));
 if(chosenFirstHours)return {...taskStep(chosenFirstHours),why:'This open task matches a first-steps responsibility you explicitly approved. It does not establish that medical, care or official steps are resolved.',alternative:{label:'Return to first-contact guidance if needed',route:'plan/first-hours'}};
 if(p.lifecycle==='not-sure')return step('Start with what you know','Choose planning ahead, arranging now or after the gathering only if it fits. You can leave facts unknown and review before applying anything.','Your starting circumstances have not been recorded. A name or memorial date does not tell us them.','Open guided start','guided');
 if(p.lifecycle==='arranging'&&!has(p.requirements['first-hours'])&&!['done','not-relevant'].includes(p.categoryStates['first-hours']))return step('Get your bearings for the immediate situation','Read a source-labelled first-contact route, then review only the practical responsibilities you want to add. This app cannot certify a death or determine release, care or legal requirements.',p.categoryStates['first-hours']==='in-progress'?'You recorded Arranging now and marked First hours In progress. Return to the open questions if helpful; this is not a mandatory sequence.':'You recorded Arranging now, but no first-hours note or family-marked progress is recorded. This is an optional handoff, not a mandatory sequence.','Open the first-steps handoff','plan/first-hours',{alternative:{label:'We have that in hand — choose another priority',route:null,choosePriority:true}});
 if(open.length)return taskStep();
 if(pending)return pendingStep();
 return decisionStep();
}


// Arrangement reports are private family records, not verified legal facts.
const arrangementReviews=new WeakMap(),settledArrangementStates=['reported-confirmed','not-needed'];
function arrangementBasis(workspace,bodyPresence){const e=eventDetails(workspace.planning);return {subjectBasis:JSON.stringify({name:workspace.memorial.name}),eventBasis:JSON.stringify({name:workspace.memorial.name,bodyPresence,...Object.fromEntries(['title','date','time','timezone','venue','address'].map(k=>[k,e[k]]))})};}
export function arrangementAssessment(workspace){
 const w=normalize(workspace),a=arrangementsDetails(w.planning),basis=arrangementBasis(w,a.bodyPresence),eventChosen=a.bodyPresence!=='no-event';
 const rows=Object.keys(ARRANGEMENT_LABELS).map(id=>({id,label:ARRANGEMENT_LABELS[id],state:a.checks[id],eventRelevant:eventChosen&&(id==='venue'||id==='provider'||id==='release'&&a.bodyPresence==='yes'),stale:settledArrangementStates.includes(a.checks[id])&&(id==='authority'?a.subjectBasis!==basis.subjectBasis:a.eventBasis!==basis.eventBasis)}));
 const unresolved=rows.filter(r=>r.eventRelevant&&(r.stale||!settledArrangementStates.includes(r.state)));
 const recorded=!!(w.planning?.schemaVersion>=3&&w.planning.arrangements);
 return {bodyPresence:a.bodyPresence,rows,unresolved,eventChosen,bodyUnknown:a.bodyPresence==='undecided',provisional:recorded&&(!eventChosen||a.bodyPresence==='undecided'||unresolved.length>0),recorded};
}
export function createArrangementDraft(workspace){
 const w=normalize(workspace),a=arrangementsDetails(w.planning),assessment=arrangementAssessment(w),checks={...a.checks};
 for(const row of assessment.rows)if(row.stale)checks[row.id]='checking';
 return {bodyPresence:a.bodyPresence,checks,rechecked:[]};
}
export function prepareArrangementReview(workspace,draft){
 const w=normalize(workspace),before=arrangementsDetails(w.planning);
 if(!draft||typeof draft!=='object'||Array.isArray(draft)||Object.keys(draft).sort().join(',')!=='bodyPresence,checks,rechecked')throw Error('Review the supported arrangement fields only.');
 if(!Array.isArray(draft.rechecked)||new Set(draft.rechecked).size!==draft.rechecked.length||draft.rechecked.some(id=>!Object.hasOwn(ARRANGEMENT_LABELS,id)))throw Error('Choose valid arrangement checks to reconfirm.');
 const a=validateArrangements({bodyPresence:draft.bodyPresence,checks:draft.checks,eventBasis:null,subjectBasis:null}),basis=arrangementBasis(w,a.bodyPresence);
 for(const id of Object.keys(ARRANGEMENT_LABELS)){
  const stale=id==='authority'?before.subjectBasis!==basis.subjectBasis:before.eventBasis!==basis.eventBasis;
  if(stale&&settledArrangementStates.includes(before.checks[id])&&settledArrangementStates.includes(a.checks[id])&&!draft.rechecked.includes(id))throw Error('The context changed. Recheck '+ARRANGEMENT_LABELS[id].toLowerCase()+' or leave it as still checking; an old report cannot be reused silently.');
 }
 const next=normalize(w);next.planning=withArrangements(w.planning,{...a,...basis});next.planning.revision++;
 const result=Object.freeze({bodyPresence:a.bodyPresence,rows:Object.freeze(Object.keys(ARRANGEMENT_LABELS).map(id=>Object.freeze({id,label:ARRANGEMENT_LABELS[id],before:before.checks[id],after:a.checks[id]}))),assessment:arrangementAssessment(next),notice:'These are family-reported planning checks, not confirmation from a provider or authority. They do not establish legal authority, book anything or grant permission.'});
 arrangementReviews.set(result,{snapshot:canonical(w),next});return result;
}
export function discardArrangementReview(review){arrangementReviews.delete(review);}
export function approveArrangementReview(review,workspace,{consent=false}={}){
 const entry=arrangementReviews.get(review);if(!entry)throw Error('Make a fresh arrangement review first.');
 if(consent!==true)throw Error('Explicitly approve the exact arrangement review first.');
 arrangementReviews.delete(review);if(entry.snapshot!==canonical(workspace))throw Error('The workspace changed. Review arrangement checks again; nothing was applied.');return clone(entry.next);
}

export function arrangementWorkspaceKey(workspace){return canonical(workspace);}

// Persisted row snapshots are identity guards, not a second editable quote store.
const costReviews=new WeakMap();
function costContext(w){const e=eventDetails(w.planning);return JSON.stringify({name:w.memorial.name,budget:w.privatePlan.budget,bodyPresence:w.planning?.arrangements?.bodyPresence??null,...Object.fromEntries(['title','date','time','timezone','venue','address'].map(k=>[k,e[k]]))});}
function costRows(plan){return [...(plan.main?[plan.main]:[]),...plan.extras];}
export function costChoiceAssessment(workspace){
 const w=normalize(workspace),plan=costPlanDetails(w.planning),rows=costRows(plan),recorded=!!(w.planning?.schemaVersion>=4&&w.planning.costPlan);
 const stale=recorded&&(plan.contextBasis!==costContext(w)||plan.quotedRowCount!==w.privatePlan.quotes.length||[...rows,...(plan.comparison?.included??[])].some(r=>JSON.stringify(r.quote)!==JSON.stringify(w.privatePlan.quotes[r.index])));
 let knownMinor=0,unknownCount=0;for(const r of rows){const amount=moneyMinor(r.quote.amount);if(amount===null)unknownCount++;else knownMinor+=amount;}
 if(!Number.isSafeInteger(knownMinor))throw Error('Selected amount overflow.');
 return {recorded,stale,plan,rows,selectedCount:rows.length,knownMinor:!stale&&rows.length?knownMinor:null,unknownCount:!stale?unknownCount:null,budgetMinor:moneyMinor(w.privatePlan.budget),funding:stale?'checking':plan.funding,allInMinor:null};
}
export function createCostDraft(workspace){const a=costChoiceAssessment(workspace);return {main:a.stale?null:a.plan.main?.index??null,extras:a.stale?[]:a.plan.extras.map(r=>r.index),funding:a.stale?'checking':a.funding,fundingRechecked:false};}
export function prepareCostReview(workspace,draft){return prepareWorkingCostReview(workspace,draft,null);}
// Used by the separately reviewed comparison flow; only existing row references enter here.
export function prepareComparedCostReview(workspace,draft,comparison){return prepareWorkingCostReview(workspace,draft,comparison);}
function prepareWorkingCostReview(workspace,draft,comparison){
 const w=normalize(workspace),before=costChoiceAssessment(w);
 if(!draft||typeof draft!=='object'||Array.isArray(draft)||Object.keys(draft).sort().join(',')!=='extras,funding,fundingRechecked,main')throw Error('Review only supported cost choices.');
 if(typeof draft.fundingRechecked!=='boolean'||!Array.isArray(draft.extras)||draft.extras.length>100)throw Error('Invalid cost review.');
 const row=index=>{if(!Number.isInteger(index)||index<0||index>=w.privatePlan.quotes.length)throw Error('Select an existing quote row.');return {index,quote:clone(w.privatePlan.quotes[index])};};
 const plan={main:draft.main===null?null:row(draft.main),extras:draft.extras.map(row),funding:draft.funding,contextBasis:costContext(w),quotedRowCount:w.privatePlan.quotes.length};
 if(comparison!==null){
  if(w.planning?.schemaVersion!==7||!comparison||typeof comparison!=='object'||Array.isArray(comparison)||Object.keys(comparison).sort().join(',')!=='included,option'||!['A','B'].includes(comparison.option)||!Array.isArray(comparison.included)||comparison.included.length>100)throw Error('Invalid working-cost comparison dependencies.');
  const included=[];for(let i=0;i<comparison.included.length;i++){const r=comparison.included[i];if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).sort().join(',')!=='includedIn,index')throw Error('Choose only current included row references.');included.push({...row(r.index),includedIn:r.includedIn});}plan.comparison={option:comparison.option,included};
 }
 const changed=before.stale||JSON.stringify([plan.main,plan.extras])!==JSON.stringify([before.plan.main,before.plan.extras]);
 if(plan.funding==='reported-available'&&(!costRows(plan).length||changed&&!draft.fundingRechecked))throw Error('Recheck available funding for this exact selected choice, or leave funding as checking.');
 const next=normalize(w);next.planning=withCostPlan(w.planning,plan);next.planning.revision++;
 serializeBackup(next); // Do not approve a snapshot that cannot fit the existing backup contract.
 const assessment=costChoiceAssessment(next),result=Object.freeze({assessment,beforeComparisonLines:comparison===null&&before.plan.comparison?costChoiceLines(w):null,notice:'A private working choice from unverified entered figures. Not a booking, contract, payment, financial recommendation or confirmed all-in price.'+(comparison===null&&before.plan.comparison?' This manual row-only choice removes the earlier included-item dependency snapshots from working costs. Saved comparison groups stay unchanged. Review bundled assumptions again; nothing is treated as included automatically.':'')});
 costReviews.set(result,{snapshot:canonical(w),next});return result;
}
export function discardCostReview(review){costReviews.delete(review);}
export function approveCostReview(review,workspace,{consent=false}={}){const entry=costReviews.get(review);if(!entry)throw Error('Make a fresh cost review first.');if(consent!==true)throw Error('Explicitly approve this exact cost choice first.');costReviews.delete(review);if(entry.snapshot!==canonical(workspace))throw Error('The workspace changed. Review the cost choice again; nothing was applied.');return clone(entry.next);}
export function costChoiceLines(workspace){
 const a=costChoiceAssessment(workspace),money=n=>'AUD '+(n/100).toFixed(2);
 if(!a.recorded)return ['No working cost choice recorded.'];
 const lines=['Working cost choice only — not a contract, payment or verified quote.'];
 if(a.stale)lines.push('STALE — selected rows, included dependencies, person/event, budget or quote list changed. No current selected subtotal or available-funds claim. Rechoose against current records.');
 if(!a.rows.length)lines.push('No offer or additional cost rows selected. Total unknown, not zero.');
 for(const r of a.rows)lines.push((a.plan.main?.index===r.index?'Main offer row (not a verified complete offer)':'Explicit additional row (check for overlap)')+(a.stale?' — historical snapshot':'')+': '+unknown(r.quote.supplier)+' / '+unknown(r.quote.item)+'\nEntered amount: '+unknown(r.quote.amount)+'\nScope: '+unknown(r.quote.scope)+'\nSource note: '+unknown(r.quote.source)+'\nDate / validity note (not parsed): '+unknown(r.quote.date)+'\nTerms: '+unknown(r.quote.terms));
 if(a.plan.comparison){lines.push('Earlier separately reviewed Option '+a.plan.comparison.option+' derivation — not synchronised with later comparison edits. Included-in entries are private family assumptions, not provider confirmation. Their amounts are NOT added to the selected subtotal.');for(const r of a.plan.comparison.included)lines.push('Family marks row '+(r.index+1)+' included in counted row '+(r.includedIn+1)+(a.stale?' — historical dependency snapshot':' — immutable dependency snapshot')+': '+unknown(r.quote.supplier)+' / '+unknown(r.quote.item)+'\nEntered amount NOT added: '+unknown(r.quote.amount)+'\nScope: '+unknown(r.quote.scope)+'\nSource note: '+unknown(r.quote.source)+'\nDate / validity note (not parsed): '+unknown(r.quote.date)+'\nTerms: '+unknown(r.quote.terms));}
 if(a.knownMinor!==null)lines.push('Known selected-row subtotal (unverified; check overlap): '+money(a.knownMinor)+'; '+a.unknownCount+' selected amount(s) unknown and excluded. Competing unselected offers are not added.');
 lines.push('Budget target: '+(a.budgetMinor===null?'Unknown / not a valid numeric amount':money(a.budgetMinor))+'. This is not money available.');
 if(a.knownMinor!==null&&a.budgetMinor!==null)lines.push(a.knownMinor>a.budgetMinor?'Known selected subtotal exceeds the target by '+money(a.knownMinor-a.budgetMinor)+', before unknown or additional charges.':'Known selected subtotal is within the target; unknown, excluded or conditional charges can still exceed it. This is not an affordability finding.');
 lines.push('Funding: '+FUNDING_STATES[a.funding]+'. Family-reported, not independently checked; recheck before any commitment.','Current all-in cost remains unknown. Check overlapping/bundled lines, matching scope, tax, exclusions, conditional charges, validity, availability, payment timing and cancellation terms with the relevant provider.','Possible later funding or reimbursement is not money available now. The app does not determine eligibility, liability, contract terms or whether a commitment is affordable.');
 return lines;
}
