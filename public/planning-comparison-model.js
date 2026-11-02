// Two family-defined options over existing rows. No provider verification, new quote facts or transport.
import {costComparisonDetails,validateCostComparison,withCostComparison,moneyMinor} from './planning-model.js';
import {validateBackup,serializeBackup} from './memorial-backup.js';
import {canonicalWorkspace} from './planning-ai.js';
import {prepareComparedCostReview,approveCostReview,discardCostReview,costChoiceLines} from './outcomes-model.js';
const drafts=new WeakMap(),reviews=new WeakMap(),workingReviews=new WeakMap();
const clone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const fields=['supplier','item','amount','scope','source','date','terms'];
const empty=()=>[{main:null,rows:[]},{main:null,rows:[]}];
function normalize(w){return validateBackup({schemaVersion:w.planning?2:1,memorial:w.memorial,privatePlan:w.privatePlan,...(w.planning?{planning:w.planning}:{})});}
const canonical=w=>canonicalWorkspace(normalize(w));
export const comparisonWorkspaceKey=canonical;
async function digest(domain,value){
 if(typeof globalThis.crypto?.subtle?.digest!=='function')throw Error('This browser cannot check local quote fingerprints. Your existing quotes and choices are unchanged.');
 const bytes=new TextEncoder().encode('Farewell Together / cost comparison v1 / '+domain+'\n'+JSON.stringify(value));
 const result=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 if(!(result instanceof ArrayBuffer)||result.byteLength!==32)throw Error('Local quote fingerprints could not be checked. Nothing was changed.');
 return [...new Uint8Array(result)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function sourceFingerprints(w){const rows=w.privatePlan.quotes.map(row=>fields.map(k=>row[k]));const [quoteBasis,subjectBasis,...rowHashes]=await Promise.all([digest('ordered quote rows',rows),digest('workspace subject',w.memorial.name),...rows.map(row=>digest('quote row',row))]);return {quoteBasis,subjectBasis,rowHashes};}
function status(record,w,hashes){
 if(!record)return {recorded:false,stale:false,reasons:[]};
 const reasons=[];if(record.subjectBasis!==hashes.subjectBasis)reasons.push('The memorial display name changed. Earlier groupings may belong to a different person.');
 if(record.quoteCount!==w.privatePlan.quotes.length||record.quoteBasis!==hashes.quoteBasis)reasons.push('The ordered quote collection changed, including a row edit, addition, removal or reorder.');
 if(record.options.some(o=>o.rows.some(r=>hashes.rowHashes[Number(r.id.slice(6))]!==r.fingerprint)))reasons.push('At least one selected row no longer matches its recorded reference.');
 return {recorded:true,stale:reasons.length>0,reasons};
}
export async function createComparisonDraft(workspace){
 const w=normalize(workspace),source=canonicalWorkspace(w),hashes=await sourceFingerprints(w),record=costComparisonDetails(w.planning),assessment=status(record,w,hashes);
 // Stale rows are never rebound by a guessed provider, new position or matching label.
 const draft={options:record&&!assessment.stale?record.options.map(o=>({main:o.main,rows:o.rows.map(r=>({id:r.id,includedIn:r.includedIn}))})):empty()};
 drafts.set(draft,{source,w,hashes,record,assessment});return draft;
}
function entry(workspace,draft){const e=drafts.get(draft);if(!e||e.source!==canonical(workspace))throw Error('The workspace changed. Keep the earlier comparison safe and start from the current quote rows.');return e;}
function metadata(e,draft){
 if(!draft||typeof draft!=='object'||Array.isArray(draft)||Object.keys(draft).join(',')!=='options'||!Array.isArray(draft.options)||draft.options.length!==2||![0,1].every(i=>Object.hasOwn(draft.options,i)))throw Error('Review only the two supported comparison options.');
 const options=draft.options.map(o=>{
  if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!=='main,rows'||!Array.isArray(o.rows)||o.rows.length>100)throw Error('Invalid comparison option.');
  const rows=[];for(let i=0;i<o.rows.length;i++){const r=o.rows[i];if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).sort().join(',')!=='id,includedIn'||typeof r.id!=='string'||!/^quote-(?:0|[1-9]\d?)$/.test(r.id)||!e.hashes.rowHashes[Number(r.id.slice(6))])throw Error('Choose current existing quote rows only.');rows.push({...r,fingerprint:e.hashes.rowHashes[Number(r.id.slice(6))]});}return {main:o.main,rows};
 });
 if(!options.some(o=>o.rows.length)){if(options.some(o=>o.main!==null))throw Error('Choose a counted main row or leave it unselected.');return null;}
 return validateCostComparison({version:1,quoteCount:e.w.privatePlan.quotes.length,quoteBasis:e.hashes.quoteBasis,subjectBasis:e.hashes.subjectBasis,options});
}
function projection(w,record){
 return (record?.options??empty()).map((o,index)=>{let knownMinor=0,unknownCount=0;const rows=o.rows.map(ref=>({id:ref.id,includedIn:ref.includedIn,...clone(w.privatePlan.quotes[Number(ref.id.slice(6))])}));
  for(const r of rows)if(r.includedIn===null){const amount=moneyMinor(r.amount);if(amount===null)unknownCount++;else knownMinor+=amount;}
  if(!Number.isSafeInteger(knownMinor))throw Error('Selected amount overflow.');
  const counted=rows.filter(r=>r.includedIn===null),included=rows.filter(r=>r.includedIn!==null),fingerprints=o.rows.filter(r=>r.includedIn===null).map(r=>r.fingerprint);
  return {index,label:'Option '+(index===0?'A':'B'),main:o.main,rows,counted,included,knownMinor:counted.length?knownMinor:null,unknownCount,countedCount:counted.length,includedCount:included.length,allInMinor:null,duplicateCountedRows:new Set(fingerprints).size!==fingerprints.length};
 });
}
export function comparisonDraftView(workspace,draft){const e=entry(workspace,draft),record=metadata(e,draft);return freeze({recorded:e.assessment.recorded,stale:e.assessment.stale,reasons:[...e.assessment.reasons],historical:e.record?clone(e.record):null,options:projection(e.w,record),matchesRecorded:!e.assessment.stale&&JSON.stringify(record)===JSON.stringify(e.record)});}
export function comparisonRecoveryInfo(draft){const e=drafts.get(draft);if(!e)throw Error('No earlier comparison draft is available.');return freeze({assessment:clone(e.assessment),options:clone(draft.options),sourceRows:clone(e.w.privatePlan.quotes),recorded:e.record?clone(e.record):null});}
export function prepareComparisonReview(workspace,draft){
 const e=entry(workspace,draft),record=metadata(e,draft);if(!record&&!e.record)throw Error('Choose at least one existing row before recording a comparison.');
 const next=normalize(workspace);next.planning=withCostComparison(next.planning,record);next.planning.revision++;serializeBackup(next);
 const result=freeze({kind:'grouping',before:e.record?clone(e.record):null,after:record?clone(record):null,clears:!record,earlierStale:e.assessment.stale,options:projection(e.w,record),notice:'Private family-defined grouping only. Included-in choices are assumptions to check with the provider, not confirmation. Raw quotes and the existing working-cost choice stay unchanged. Saving respects your existing choice; no quote is accepted, person contacted or payment made.'});
 reviews.set(result,{source:e.source,next});return result;
}
export function discardComparisonReview(review){reviews.delete(review);}
export function approveComparisonReview(review,workspace,{consent=false}={}){const e=reviews.get(review);if(!e)throw Error('Make a fresh comparison review.');if(consent!==true)throw Error('Approve these exact grouping choices first.');reviews.delete(review);if(e.source!==canonical(workspace))throw Error('The workspace changed after review. No comparison was applied.');return clone(e.next);}
export function prepareComparedWorkingChoice(workspace,draft,option){
 if(![0,1].includes(option))throw Error('Choose Option A or B explicitly.');const e=entry(workspace,draft),record=metadata(e,draft);
 if(!e.record||e.assessment.stale||JSON.stringify(record)!==JSON.stringify(e.record))throw Error('Review and apply these current groupings first. A stale or temporary comparison cannot choose the working costs.');
 const selected=record.options[option],counted=selected.rows.filter(r=>r.includedIn===null);if(!counted.length)throw Error('This option has no counted rows. Its cost is unknown, not zero.');
 const main=selected.main===null?null:Number(selected.main.slice(6)),extras=counted.filter(r=>r.id!==selected.main).map(r=>Number(r.id.slice(6)));
 const inner=prepareComparedCostReview(workspace,{main,extras,funding:'checking',fundingRechecked:false},{option:option===0?'A':'B',included:selected.rows.filter(r=>r.includedIn!==null).map(r=>({index:Number(r.id.slice(6)),includedIn:Number(r.includedIn.slice(6))}))});
 const result=freeze({kind:'working-choice',option,optionLabel:option===0?'Option A':'Option B',before:costChoiceLines(workspace),assessment:inner.assessment,selected:projection(e.w,record)[option],notice:'This separate review replaces the existing working-cost choice with this option’s counted rows only. Explicitly included rows stay in the saved comparison and become immutable private working-cost dependency snapshots, but their amounts are not added again. Those dependency facts appear in a separately selected private organiser cost section, never guest/helper/day copies. Funding starts as Checking. No offer is accepted, provider ranked, booking made or payment authorised. Your raw quotes, other option and saving choice stay unchanged.'});
 workingReviews.set(result,{source:e.source,inner});return result;
}
export function discardComparedWorkingChoice(review){const e=workingReviews.get(review);if(e)discardCostReview(e.inner);workingReviews.delete(review);}
export function approveComparedWorkingChoice(review,workspace,{consent=false}={}){const e=workingReviews.get(review);if(!e)throw Error('Make a fresh working-cost review.');if(consent!==true)throw Error('Approve this exact working-cost choice first.');workingReviews.delete(review);if(e.source!==canonical(workspace)){discardCostReview(e.inner);throw Error('The workspace changed. No working-cost choice was applied.');}return approveCostReview(e.inner,workspace,{consent:true});}
