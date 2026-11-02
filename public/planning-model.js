// Dependency-free private planning contract. No transport, credentials, file access or side effects.
export const PLANNING_SCHEMA_VERSION = 7;
export const EVENT_FIELDS = ['title','date','time','venue','address','arrivalTime','lead','contact','timezone','guestInfo'];
export const blankEvent = () => Object.fromEntries(EVENT_FIELDS.map(key => [key, '']));
export function validateEvent(value) {
  record(value, EVENT_FIELDS, 'Event details');
  const result = Object.fromEntries(EVENT_FIELDS.map(key => [key, string(value[key], key === 'guestInfo' ? 2000 : 500)]));
  if (result.date && (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || !Number.isFinite(Date.parse(result.date)) || new Date(result.date).toISOString().slice(0,10) !== result.date)) throw Error('Event date must be a real YYYY-MM-DD date, or blank.');
  for (const key of ['time','arrivalTime']) if (result[key] && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result[key])) throw Error('Event times must use HH:MM, or stay blank.');
  return result;
}
// Schema 1 remains valid and is not rewritten just by opening an older workspace.
export function eventDetails(planning) { const p = validatePlanning(planning === undefined ? createPlanning() : planning); return p.schemaVersion >= 2 ? {...p.event} : blankEvent(); }
// Explicit edit-time migration; callers own revision increments and saving consent.
export function withEventDetails(planning, event) { const p=validatePlanning(planning === undefined ? createPlanning() : planning); return {...p, schemaVersion:Math.max(2,p.schemaVersion), event:validateEvent(event)}; }
export const LIFECYCLES = ['not-sure', 'preplanning', 'arranging', 'aftercare'];
export const CATEGORY_STATES = ['not-started', 'in-progress', 'done', 'not-relevant'];
const clone = value => JSON.parse(JSON.stringify(value));
function record(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw Error(`${label}: missing or unknown fields.`);
}
function string(value, max = 2000) { if (typeof value !== 'string' || value.length > max) throw Error('Invalid bounded text.'); return value; }
function choice(value, values) { if (!values.includes(value)) throw Error('Invalid state.'); return value; }
function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value) || ['__proto__','constructor','prototype'].includes(value)) throw Error('Invalid identifier.'); return value; }
function integer(value) { if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid non-negative integer.'); return value; }
function map(value, validate, limit = 100) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > limit) throw Error('Invalid bounded map.'); return Object.fromEntries(Object.entries(value).map(([k,v]) => [id(k), validate(v)])); }
function array(value, validate, max = 100) { if (!Array.isArray(value) || value.length > max) throw Error('Invalid bounded list.'); return value.map(validate); }
function iso(value) { if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(value) || !Number.isFinite(Date.parse(value)))) throw Error('Invalid date.'); return value; }
export function createPlanning() { return { schemaVersion: 1, revision: 0, lifecycle: 'not-sure', jurisdiction: '', categoryStates: {}, requirements: {}, customNeeds: [], proposals: [], audit: [] }; }
function payload(type, value) {
  if (type === 'tasks.add') { record(value, ['task','owner','status'], 'Task'); return {task:string(value.task),owner:string(value.owner),status:choice(value.status,['Not started','In progress','Done'])}; }
  if (type === 'planning.update') { record(value,['lifecycle','jurisdiction'],'Planning update'); return {lifecycle:choice(value.lifecycle,LIFECYCLES),jurisdiction:string(value.jurisdiction,120)}; }
  if (type === 'requirements.set') { record(value,['category','text'],'Requirements'); return {category:id(value.category),text:string(value.text,12000)}; }
  throw Error('Command unavailable. Only local draft changes are supported.');
}
function proposal(value) {
  record(value,['id','type','payload','baseRevision','status'],'Proposal');
  return {id:id(value.id),type:value.type,payload:payload(value.type,value.payload),baseRevision:integer(value.baseRevision),status:choice(value.status,['pending','approved','rejected'])};
}
export function validatePlanning(value) {
  record(value,['schemaVersion','revision','lifecycle','jurisdiction','categoryStates','requirements','customNeeds','proposals','audit',...(value?.schemaVersion >= 2 ? ['event'] : []),...(value?.schemaVersion >= 3 ? ['arrangements'] : []),...(value?.schemaVersion >= 4 ? ['costPlan'] : []),...(value?.schemaVersion >= 5 ? ['ceremonySequence'] : []),...(value?.schemaVersion >= 6 ? ['afterward'] : []),...(value?.schemaVersion >= 7 ? ['costComparison'] : [])],'Planning');
  if (![1,2,3,4,5,6,7].includes(value.schemaVersion)) throw Error('Unsupported planning schema.');
  const result = {...(value.schemaVersion >= 2 ? {event:validateEvent(value.event)} : {}),...(value.schemaVersion >= 3 ? {arrangements:value.schemaVersion>=4&&value.arrangements===null?null:validateArrangements(value.arrangements)} : {}),...(value.schemaVersion>=4?{costPlan:value.schemaVersion>=5&&value.costPlan===null?null:validateCostPlan(value.costPlan,{allowComparison:value.schemaVersion>=7})}:{}),...(value.schemaVersion>=5?{ceremonySequence:value.schemaVersion>=6&&value.ceremonySequence===null?null:validateCeremonySequence(value.ceremonySequence)}:{}),...(value.schemaVersion>=6?{afterward:value.schemaVersion>=7&&value.afterward===null?null:validateAfterward(value.afterward)}:{}),...(value.schemaVersion>=7?{costComparison:value.costComparison===null?null:validateCostComparison(value.costComparison)}:{}),schemaVersion:value.schemaVersion, revision:integer(value.revision), lifecycle:choice(value.lifecycle,LIFECYCLES),jurisdiction:string(value.jurisdiction,120),categoryStates:map(value.categoryStates,v=>choice(v,CATEGORY_STATES)),requirements:map(value.requirements,v=>string(v,12000)),customNeeds:array(value.customNeeds,v=>{record(v,['id','title','status','notes'],'Custom need');return {id:id(v.id),title:string(v.title,200),status:choice(v.status,CATEGORY_STATES),notes:string(v.notes,12000)};}),proposals:array(value.proposals,proposal),audit:array(value.audit,v=>{record(v,['proposalId','decision','revision'],'Audit');return {proposalId:id(v.proposalId),decision:choice(v.decision,['approved','rejected']),revision:integer(v.revision)};})};
  for (const rows of [result.customNeeds,result.proposals]) if(new Set(rows.map(v=>v.id)).size!==rows.length) throw Error('Duplicate identifiers.');
  if (result.proposals.some(v=>v.baseRevision>result.revision) || result.audit.some(v=>v.revision>result.revision)) throw Error('Invalid future revision.');
  return result;
}
// Canonical amounts remain in existing privatePlan rows; these adapters do not create a second budget.
export function moneyMinor(value) { return typeof value === 'string' && /^\d{1,9}(?:\.\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value.trim())*100) : null; }
export function validateEvidence(value) {
  record(value,['id','kind','reference','jurisdiction','observedAt','publishedAt','validUntil','reviewStatus'],'Evidence');
  if(value.reviewStatus==='reviewed' && (!value.reference.trim() || !value.observedAt)) throw Error('Reviewed evidence needs a reference and observation date.');
  return {id:id(value.id),kind:choice(value.kind,['family-entry','provider-document','official-source']),reference:string(value.reference),jurisdiction:string(value.jurisdiction,120),observedAt:iso(value.observedAt),publishedAt:iso(value.publishedAt),validUntil:iso(value.validUntil),reviewStatus:choice(value.reviewStatus,['unverified','reviewed'])};
}
export function validateRequirement(value, asOf = new Date().toISOString()) {
  iso(asOf); if(asOf===null)throw Error('An as-of date is required.');
  record(value,['classification','description','jurisdiction','sourceRefs','applicability','reviewedAt'],'Requirement');
  const result={classification:choice(value.classification,['optional','provider-claim','legal-unverified','legal-required','professional-handoff']),description:string(value.description),jurisdiction:string(value.jurisdiction,120),sourceRefs:array(value.sourceRefs,validateEvidence,20),applicability:string(value.applicability),reviewedAt:iso(value.reviewedAt)};
  if (result.classification==='legal-required' && (!result.jurisdiction || !result.applicability || !result.reviewedAt || Date.parse(result.reviewedAt)>Date.parse(asOf) || !result.sourceRefs.some(e=>e.kind==='official-source' && e.reviewStatus==='reviewed' && e.jurisdiction===result.jurisdiction && /^https:\/\//.test(e.reference) && e.observedAt && Date.parse(e.observedAt)<=Date.parse(asOf) && (!e.validUntil || Date.parse(e.validUntil)>=Date.parse(asOf))))) throw Error('Legal requirement needs matching reviewed official evidence and applicability.');
  return result;
}
export function quoteFromLegacy(row, index=0, jurisdiction='') {
  const amount=moneyMinor(row.amount), source={id:`legacy-source-${index}`,kind:'family-entry',reference:string(row.source),jurisdiction:string(jurisdiction,120),observedAt:null,publishedAt:null,validUntil:null,reviewStatus:'unverified'};
  return {id:`legacy-quote-${index}`,planId:'local-plan',providerId:null,providerLabel:string(row.supplier),scopeVersion:1,jurisdiction,currency:'AUD',issuedAt:null,retrievedAt:null,validUntil:null,availabilityStatus:'unknown',serviceDates:[],sourceRefs:[source],originalDocumentRef:null,reviewStatus:'unverified',assumptions:['Legacy date / validity note (not parsed):',string(row.date),'Legacy terms:',string(row.terms)],scopeConfirmed:false,lines:[{id:`legacy-line-${index}`,category:'unclassified',description:string(row.item),quantity:null,unit:'',unitPriceMinor:null,amountMinor:amount,taxTreatment:'unknown',gstMinor:null,includedInLineId:null,mandatoryClass:'unclassified',requirementEvidence:[],includedScope:string(row.scope),excludedScope:'',conditionalTrigger:'',status:amount===null?'unknown':'estimate',sourceRef:source.id}]};
}
export function validateQuote(value) {
  record(value,['id','planId','providerId','providerLabel','scopeVersion','jurisdiction','currency','issuedAt','retrievedAt','validUntil','availabilityStatus','serviceDates','sourceRefs','originalDocumentRef','reviewStatus','assumptions','scopeConfirmed','lines'],'Quote');
  id(value.id);id(value.planId);if(value.providerId!==null)id(value.providerId);string(value.providerLabel);integer(value.scopeVersion);string(value.jurisdiction,120);if(!/^[A-Z]{3}$/.test(value.currency))throw Error('Invalid currency.');
  for(const k of ['issuedAt','retrievedAt','validUntil'])iso(value[k]);choice(value.availabilityStatus,['unknown','requested','confirmed','unavailable']);array(value.serviceDates,iso,20);const sources=array(value.sourceRefs,validateEvidence,100);if(value.originalDocumentRef!==null)string(value.originalDocumentRef);choice(value.reviewStatus,['unverified','reviewed']);array(value.assumptions,v=>string(v),100);if(typeof value.scopeConfirmed!=='boolean')throw Error('Invalid scope confirmation.');
  const lines=array(value.lines,line=>{record(line,['id','category','description','quantity','unit','unitPriceMinor','amountMinor','taxTreatment','gstMinor','includedInLineId','mandatoryClass','requirementEvidence','includedScope','excludedScope','conditionalTrigger','status','sourceRef'],'Quote line');id(line.id);id(line.category);for(const key of ['description','unit','includedScope','excludedScope','conditionalTrigger'])string(line[key]);for(const key of ['quantity','unitPriceMinor','amountMinor','gstMinor'])if(line[key]!==null)integer(line[key]);choice(line.taxTreatment,['unknown','included','excluded','not-applicable']);if(line.includedInLineId!==null)id(line.includedInLineId);choice(line.mandatoryClass,['unclassified','optional','provider-claim','legal-unverified','professional-handoff']);array(line.requirementEvidence,validateEvidence,20);choice(line.status,['fixed','estimate','range','unknown','not-applicable']);if((line.status==='unknown'||line.status==='range')&&line.amountMinor!==null)throw Error('Unknown/range amount must be null.');if(line.status==='fixed'&&line.amountMinor===null)throw Error('Fixed price needs amount.');if(!sources.some(s=>s.id===line.sourceRef))throw Error('Missing line provenance.');return line;},100);
  if(new Set(lines.map(l=>l.id)).size!==lines.length)throw Error('Duplicate quote line.');
  for(const line of lines)if(line.includedInLineId!==null && (line.includedInLineId===line.id || !lines.some(l=>l.id===line.includedInLineId && l.includedInLineId===null)))throw Error('Invalid bundled line mapping.');
  return clone(value);
}
export function quoteSummary(quotes, asOf = new Date().toISOString()) {
  iso(asOf);if(asOf===null)throw Error('An as-of date is required.');
  const now=Date.parse(asOf),notFuture=date=>date===null||Date.parse(date)<=now,notExpired=date=>date===null||Date.parse(date)>=now;
  // Stale prices remain historical known subtotals, never a current all-in total.

  return quotes.map(raw=>{const q=validateQuote(raw);let knownMinor=0,unknown=0,conditional=0;for(const line of q.lines){if(line.status==='not-applicable'||line.includedInLineId!==null)continue;if(line.conditionalTrigger){conditional++;continue;}if(line.amountMinor===null)unknown++;else knownMinor+=line.amountMinor;}if(!Number.isSafeInteger(knownMinor))throw Error('Amount overflow.');return {id:q.id,currency:q.currency,knownMinor,unknown,conditional,allInMinor:notExpired(q.validUntil)&&notFuture(q.issuedAt)&&notFuture(q.retrievedAt)&&q.sourceRefs.every(s=>notFuture(s.observedAt)&&notFuture(s.publishedAt)&&notExpired(s.validUntil))&&q.lines.length>0&&q.scopeConfirmed&&q.reviewStatus==='reviewed'&&unknown===0&&conditional===0&&q.lines.every(l=>l.status==='not-applicable'||l.status==='fixed'&&(l.taxTreatment==='included'||l.taxTreatment==='not-applicable'))&&q.sourceRefs.every(s=>s.reviewStatus==='reviewed')?knownMinor:null};});
}
export function proposeCommand(workspace, command) {
  record(command,['id','expectedRevision','type','payload'],'Command');id(command.id);integer(command.expectedRevision);const p=validatePlanning(workspace.planning||createPlanning()), content=payload(command.type,command.payload);
  const existing=p.proposals.find(v=>v.id===command.id);if(existing){if(existing.type!==command.type||JSON.stringify(existing.payload)!==JSON.stringify(content))throw Error('Idempotency key reused with different content.');return clone(workspace);}
  if(command.expectedRevision!==p.revision)throw Error('Stale plan revision. Review again.');if(p.proposals.length>=100)throw Error('Proposal limit reached.');p.revision++;p.proposals.push({id:command.id,type:command.type,payload:content,baseRevision:p.revision,status:'pending'});return {...clone(workspace),planning:p};
}
export function decideProposal(workspace, decision) {
  record(decision,['id','expectedRevision','decision'],'Decision');id(decision.id);integer(decision.expectedRevision);choice(decision.decision,['approved','rejected']);const p=validatePlanning(workspace.planning||createPlanning()), entry=p.proposals.find(v=>v.id===decision.id);if(!entry)throw Error('Unknown proposal.');if(entry.status!=='pending'){if(entry.status===decision.decision)return clone(workspace);throw Error('Proposal already decided.');}
  if(decision.expectedRevision!==p.revision || decision.decision==='approved' && entry.baseRevision!==p.revision)throw Error('Stale proposal. Create a fresh proposal against current data.');if(p.audit.length>=100)throw Error('Audit limit reached.');const next=clone(workspace);if(decision.decision==='approved'){if(entry.type==='tasks.add'){if(next.privatePlan.tasks.length>=100)throw Error('Task limit reached.');next.privatePlan.tasks.push(clone(entry.payload));}else if(entry.type==='planning.update'){p.lifecycle=entry.payload.lifecycle;p.jurisdiction=entry.payload.jurisdiction;}else if(entry.type==='requirements.set'){p.requirements[entry.payload.category]=entry.payload.text;}}
  entry.status=decision.decision;p.revision++;p.audit.push({proposalId:entry.id,decision:entry.status,revision:p.revision});next.planning=validatePlanning(p);return next;
}

// Optional family-reported checks, never official verification or instructions.
export const ARRANGEMENT_LABELS=Object.freeze({authority:'Decision-making questions',care:'Care and transfer handoff',release:'Body availability / release for this event',venue:'Place and timing arrangements',provider:'Outside services chosen for this event'});
export const ARRANGEMENT_STATES=Object.freeze({unknown:'Not recorded / unknown',checking:'Still checking',unresolved:'Unresolved — appropriate help needed','reported-confirmed':'Family reports confirmation','not-needed':'Not part of this event / working plan'});
export const BODY_PRESENCE=Object.freeze({undecided:'Not decided / not sure',yes:'Yes — this event relies on the body being present',no:'No — a separate memorial without the body','no-event':'No gathering is currently chosen'});
export function blankArrangements(){return {bodyPresence:'undecided',checks:Object.fromEntries(Object.keys(ARRANGEMENT_LABELS).map(k=>[k,'unknown'])),eventBasis:null,subjectBasis:null};}
export function validateArrangements(value){
 record(value,['bodyPresence','checks','eventBasis','subjectBasis'],'Arrangement checks');choice(value.bodyPresence,Object.keys(BODY_PRESENCE));record(value.checks,Object.keys(ARRANGEMENT_LABELS),'Arrangement check states');
 const checks=Object.fromEntries(Object.keys(ARRANGEMENT_LABELS).map(k=>[k,choice(value.checks[k],Object.keys(ARRANGEMENT_STATES))]));
 if(!['no','no-event'].includes(value.bodyPresence)&&checks.release==='not-needed')throw Error('For a body-dependent event, keep body availability unknown/checking until the responsible service confirms it.');
 if(value.eventBasis!==null)string(value.eventBasis,18000);if(value.subjectBasis!==null)string(value.subjectBasis,1500);
 return {bodyPresence:value.bodyPresence,checks,eventBasis:value.eventBasis,subjectBasis:value.subjectBasis};
}
export function arrangementsDetails(planning){const p=validatePlanning(planning===undefined?createPlanning():planning);return p.schemaVersion>=3&&p.arrangements?clone(p.arrangements):blankArrangements();}
export function withArrangements(planning,arrangements){const p=validatePlanning(planning===undefined?createPlanning():planning);return {...p,schemaVersion:Math.max(3,p.schemaVersion),event:p.schemaVersion>=2?p.event:blankEvent(),arrangements:validateArrangements(arrangements)};}

// A provisional cost choice, not a second budget or a contract/payment ledger.
export const FUNDING_STATES=Object.freeze({unknown:'Not recorded / unknown',checking:'Checking what is available','not-available':'Funds not available now','possible-later':'Possible later funding / reimbursement only','reported-available':'Family reports some funds available — sufficiency not established'});
export const COST_QUOTE_FIELDS=Object.freeze(['supplier','item','amount','scope','source','date','terms']);
export function blankCostPlan(){return {main:null,extras:[],funding:'unknown',contextBasis:null,quotedRowCount:0};}
export function validateCostPlan(value,{allowComparison=false}={}){
 const hasComparison=allowComparison&&Object.hasOwn(value??{},'comparison');
 record(value,['main','extras','funding','contextBasis','quotedRowCount',...(hasComparison?['comparison']:[])],'Cost choice');
 const row=v=>{record(v,['index','quote'],'Selected quote');integer(v.index);if(v.index>99)throw Error('Invalid selected quote index.');record(v.quote,COST_QUOTE_FIELDS,'Selected quote facts');return {index:v.index,quote:Object.fromEntries(COST_QUOTE_FIELDS.map(k=>[k,string(v.quote[k])]))};};
 const main=value.main===null?null:row(value.main),extras=array(value.extras,row),indices=[...(main?[main.index]:[]),...extras.map(v=>v.index)];
 integer(value.quotedRowCount);if(value.quotedRowCount>100||indices.some(i=>i>=value.quotedRowCount)||new Set(indices).size!==indices.length)throw Error('Choose distinct existing cost rows; an offer cannot also be its own extra.');
 if(value.contextBasis!==null)string(value.contextBasis,22000);choice(value.funding,Object.keys(FUNDING_STATES));
 let comparison;
 if(hasComparison){const source=value.comparison;record(source,['option','included'],'Working-cost comparison dependencies');choice(source.option,['A','B']);if(!Array.isArray(source.included)||source.included.length>100||Array.from({length:source.included.length},(_,i)=>i).some(i=>!Object.hasOwn(source.included,i)))throw Error('Invalid included dependencies.');
  const included=source.included.map(r=>{record(r,['index','quote','includedIn'],'Included cost dependency');const snapshot=row({index:r.index,quote:r.quote});integer(r.includedIn);if(snapshot.index>=value.quotedRowCount||indices.includes(snapshot.index)||!indices.includes(r.includedIn))throw Error('An included dependency must be distinct from and linked to a counted row.');return {...snapshot,includedIn:r.includedIn};});
  if(new Set(included.map(r=>r.index)).size!==included.length||!indices.length)throw Error('Keep distinct included dependencies for a nonempty working choice.');comparison={option:source.option,included};
 }
 return {main,extras,funding:value.funding,contextBasis:value.contextBasis,quotedRowCount:value.quotedRowCount,...(hasComparison?{comparison}:{})};
}
export function costPlanDetails(planning){const p=validatePlanning(planning===undefined?createPlanning():planning);return p.schemaVersion>=4&&p.costPlan?clone(p.costPlan):blankCostPlan();}
export function withCostPlan(planning,costPlan){const p=validatePlanning(planning===undefined?createPlanning():planning);return {...p,schemaVersion:Math.max(4,p.schemaVersion),event:p.schemaVersion>=2?p.event:blankEvent(),arrangements:p.schemaVersion>=3?p.arrangements:null,costPlan:validateCostPlan(costPlan,{allowComparison:p.schemaVersion>=7})};}

// Explicit guest service words and private operator cues for one recorded sequence.
export const SEQUENCE_FIELDS=Object.freeze(['id','title','words','owner','cue','fallback']);
export function validateSequenceItems(value){
 const rows=array(value,item=>{record(item,SEQUENCE_FIELDS,'Ceremony moment');return {id:id(item.id),title:string(item.title,200),words:string(item.words,20000),owner:string(item.owner),cue:string(item.cue),fallback:string(item.fallback)};},50);
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Ceremony moment identifiers must be unique.');
 if(rows.some(r=>!['title','words','owner','cue','fallback'].some(k=>r[k].trim())))throw Error('Add guest words or a private cue, or remove the empty moment.');
 return rows;
}
export function validateCeremonySequence(value){record(value,['items','serviceBasis','contextBasis'],'Ceremony sequence');return {items:validateSequenceItems(value.items),serviceBasis:string(value.serviceBasis,20000),contextBasis:string(value.contextBasis,22000)};}
export function ceremonySequenceDetails(planning){const p=validatePlanning(planning===undefined?createPlanning():planning);return p.schemaVersion>=5&&p.ceremonySequence?clone(p.ceremonySequence):null;}
export function withCeremonySequence(planning,ceremonySequence){const p=validatePlanning(planning===undefined?createPlanning():planning);return {...p,schemaVersion:Math.max(5,p.schemaVersion),event:p.schemaVersion>=2?p.event:blankEvent(),arrangements:p.schemaVersion>=3?p.arrangements:null,costPlan:p.schemaVersion>=4?p.costPlan:null,ceremonySequence:validateCeremonySequence(ceremonySequence)};}

// Optional chosen afterward actions. Statuses are family records, not external confirmations.
export const AFTERWARD_STATES=Object.freeze({'to-contact':'Not yet asked / next action to choose','waiting-reply':'Waiting for a reply','waiting-evidence':'Waiting for evidence or another person','reported-complete':'Family reports this chosen action complete','not-needed':'Family says this action is not needed'});
export const AFTERWARD_KINDS=Object.freeze({notification:'Notification / organisation question',paperwork:'Paperwork / official process question',belongings:'Belongings or practical handover',ashes:'Ashes / remembrance question',thanks:'Thanks or keepsake',support:'Support or practical help',custom:'Another chosen action'});
export const AFTERWARD_FIELDS=Object.freeze(['id','kind','title','question','owner','status','waitingOn','nextCheck','note','statusBasis']);
export function afterwardActionBasis(row){return JSON.stringify({kind:row.kind,title:row.title,question:row.question});}
export function validateAfterwardItems(value){
 const rows=array(value,row=>{record(row,AFTERWARD_FIELDS,'Afterward action');const nextCheck=string(row.nextCheck,10);if(nextCheck&&(!/^\d{4}-\d{2}-\d{2}$/.test(nextCheck)||!Number.isFinite(Date.parse(nextCheck))||new Date(nextCheck).toISOString().slice(0,10)!==nextCheck))throw Error('Choose a real check date, or leave it blank.');const result={id:id(row.id),kind:choice(row.kind,Object.keys(AFTERWARD_KINDS)),title:string(row.title,200),question:string(row.question),owner:string(row.owner,500),status:choice(row.status,Object.keys(AFTERWARD_STATES)),waitingOn:string(row.waitingOn,1000),nextCheck,note:string(row.note),statusBasis:row.statusBasis===null?null:string(row.statusBasis,14000)};if(!result.title.trim())throw Error('Give the chosen action a short label, or remove the empty row.');return result;},50);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Afterward action identifiers must be unique.');return rows;
}
export function validateAfterward(value){record(value,['items','subjectBasis'],'Afterward handover');return {items:validateAfterwardItems(value.items),subjectBasis:value.subjectBasis===null?null:string(value.subjectBasis,2000)};}
export function afterwardDetails(planning){const p=validatePlanning(planning===undefined?createPlanning():planning);return p.schemaVersion>=6&&p.afterward?clone(p.afterward):{items:[],subjectBasis:null};}
export function withAfterward(planning,afterward){const p=validatePlanning(planning===undefined?createPlanning():planning);return {...p,schemaVersion:Math.max(6,p.schemaVersion),event:p.schemaVersion>=2?p.event:blankEvent(),arrangements:p.schemaVersion>=3?p.arrangements:null,costPlan:p.schemaVersion>=4?p.costPlan:null,ceremonySequence:p.schemaVersion>=5?p.ceremonySequence:null,afterward:validateAfterward(afterward)};}

// Optional grouping metadata only. Original quote facts stay in privatePlan.quotes.
export function validateCostComparison(value){
 record(value,['version','quoteCount','quoteBasis','subjectBasis','options'],'Cost comparison');
 if(value.version!==1)throw Error('Unsupported comparison metadata version.');integer(value.quoteCount);if(value.quoteCount>100)throw Error('Too many referenced quote rows.');
 const digest=v=>{if(typeof v!=='string'||!/^([0-9a-f]{64})$/.test(v))throw Error('Invalid comparison fingerprint.');return v;};
 const ref=v=>{if(typeof v!=='string'||!/^quote-(?:0|[1-9]\d?)$/.test(v)||Number(v.slice(6))>=value.quoteCount)throw Error('Invalid comparison row reference.');return v;};
 if(!Array.isArray(value.options)||value.options.length!==2||![0,1].every(i=>Object.hasOwn(value.options,i)))throw Error('Keep exactly two comparison options.');
 const options=value.options.map(option=>{record(option,['main','rows'],'Comparison option');if(!Array.isArray(option.rows)||option.rows.length>100||Array.from({length:option.rows.length},(_,i)=>i).some(i=>!Object.hasOwn(option.rows,i)))throw Error('Invalid comparison rows.');
  const rows=option.rows.map(r=>{record(r,['id','fingerprint','includedIn'],'Comparison row');return {id:ref(r.id),fingerprint:digest(r.fingerprint),includedIn:r.includedIn===null?null:ref(r.includedIn)};});
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('A row may appear only once within an option.');
  for(const r of rows)if(r.includedIn!==null&&(r.includedIn===r.id||!rows.some(parent=>parent.id===r.includedIn&&parent.includedIn===null)))throw Error('An included row needs a different counted parent within the same option. Nested or circular inclusion is not supported.');
  const main=option.main===null?null:ref(option.main);if(main!==null&&!rows.some(r=>r.id===main&&r.includedIn===null))throw Error('The optional main row must be counted in that option.');return {main,rows};
 });
 if(!options.some(o=>o.rows.length))throw Error('Use null to clear an empty comparison.');
 return {version:1,quoteCount:value.quoteCount,quoteBasis:digest(value.quoteBasis),subjectBasis:digest(value.subjectBasis),options};
}
export function costComparisonDetails(planning){const p=validatePlanning(planning===undefined?createPlanning():planning);return p.schemaVersion>=7&&p.costComparison?clone(p.costComparison):null;}
export function withCostComparison(planning,comparison){const p=validatePlanning(planning===undefined?createPlanning():planning);return {...p,schemaVersion:7,event:p.schemaVersion>=2?p.event:blankEvent(),arrangements:p.schemaVersion>=3?p.arrangements:null,costPlan:p.schemaVersion>=4?p.costPlan:null,ceremonySequence:p.schemaVersion>=5?p.ceremonySequence:null,afterward:p.schemaVersion>=6?p.afterward:null,costComparison:comparison===null?null:validateCostComparison(comparison)};}
