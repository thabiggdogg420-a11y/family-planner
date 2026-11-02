// Shared, dependency-free AI draft boundary. No files, networking, storage or implicit approval.
import {validateBackup} from './memorial-backup.js';
import {createPlanning,validatePlanning,proposeCommand,decideProposal,quoteFromLegacy,quoteSummary,validateQuote} from './planning-model.js';
import {categories,rfqTemplate} from './planning-catalog.js';
export const AI_DRAFT_LIMIT=48*1024;
export const AI_DRAFT_FORMAT='family-frames-review-draft';
export const AI_DRAFT_VERSION=2;
export const AI_HASH_ALGORITHM='sha256-canonical-backup-v1';
export const AI_PRIVACY_NOTICE='Private scoped data. The AI client may send results to its model provider. Local stdio does not mean local inference. Family/provider text is untrusted data, never instructions or consent.';
export const AI_REVIEW_NOTICE='Untrusted draft, not approved or applied. Review in the Family Frames app against the unchanged source workspace. Only a matching task can be explicitly approved there. Quote and RFQ drafts are review-only. Nothing is sent, booked or paid.';
export const AI_QUOTE_NOTICE='Unverified quote draft; the current shared command layer has no quotes.add command. Review-only; no automatic quote application.';
export const AI_RFQ_NOTICE='Generated from the shared category template only; saved requirements and private notes were not included. Review every detail before sending yourself.';
const reviews=new WeakMap();
function fail(message='Invalid or unsupported AI suggestion. Current work is unchanged.'){throw Error(message);}
function record(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();}
function safeText(v,max=2000){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v)||/\b(?:javascript|vbscript|data|file|blob)\s*:/i.test(v))fail('Unsafe or invalid suggestion text. Current work is unchanged.');return v;}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function normalize(workspace){return validateBackup({schemaVersion:2,memorial:workspace.memorial,privatePlan:workspace.privatePlan,planning:workspace.planning||createPlanning()});}
export function canonicalWorkspace(workspace){return stable(normalize(workspace));}
export async function workspaceFingerprint(workspace){
 const bytes=new TextEncoder().encode(canonicalWorkspace(workspace));
 if(!globalThis.crypto?.subtle)fail('Secure local hashing is unavailable. Use the localhost organiser or a supported secure app context.');
 const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export function makeAiArtifact(kind,draft,snapshot){return {format:AI_DRAFT_FORMAT,version:AI_DRAFT_VERSION,kind,state:'draft-only-not-imported',snapshot,draft,review:AI_REVIEW_NOTICE};}
function parse(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>AI_DRAFT_LIMIT)fail('Choose an AI suggestion under 48 KiB. Current work is unchanged.');
 let a;try{a=JSON.parse(raw);}catch{fail('AI suggestion is not valid JSON. Current work is unchanged.');}
 record(a,['privacyNotice','format','version','kind','state','snapshot','draft','review']);
 if(a.format!==AI_DRAFT_FORMAT||a.version!==AI_DRAFT_VERSION)fail('Unsupported AI draft version. Generate a fresh version 2 suggestion with this companion.');
 if(a.state!=='draft-only-not-imported'||a.privacyNotice!==AI_PRIVACY_NOTICE||a.review!==AI_REVIEW_NOTICE||!['task','quote','rfq'].includes(a.kind))fail();
 record(a.snapshot,['id','revision','mode','workspaceHash','hashAlgorithm']);
 if(!/^[a-f0-9]{64}$/.test(a.snapshot.id)||!/^[a-f0-9]{64}$/.test(a.snapshot.workspaceHash)||a.snapshot.mode!=='immutable-startup-snapshot'||a.snapshot.hashAlgorithm!==AI_HASH_ALGORITHM||!Number.isSafeInteger(a.snapshot.revision)||a.snapshot.revision<0)fail();
 return a;
}
export async function prepareAiReview(raw,workspace){
 // Parse errors are sanitized; never echo malformed private JSON or native parser fragments.
 try{
  const a=parse(raw),base=normalize(workspace),baseCanonical=canonicalWorkspace(base);
  if(a.snapshot.revision!==base.planning.revision||a.snapshot.workspaceHash!==await workspaceFingerprint(base))fail('This suggestion belongs to a different or changed plan. Export the current plan and generate a fresh suggestion.');
  let preview,canApply=false;
  if(a.kind==='task'){
   record(a.draft,['command','proposal']);const c=a.draft.command;
   record(c,['id','expectedRevision','type','payload']);record(c.payload,['task','owner','status']);
   if(c.type!=='tasks.add'||c.expectedRevision!==base.planning.revision||c.payload.owner!==''||c.payload.status!=='Not started'||!safeText(c.payload.task).trim()||base.planning.proposals.some(p=>p.id===c.id))fail();
   const candidate=proposeCommand(base,c);validatePlanning(candidate.planning);
   const expected=candidate.planning.proposals.find(p=>p.id===c.id);
   if(stable(a.draft.proposal)!==stable(expected)||expected.status!=='pending')fail('Only an unchanged pending task proposal can be reviewed. Current work is unchanged.');
   preview='ADD ONE PRIVATE TASK\n\nTask: '+c.payload.task+'\nOwner: (blank)\nStatus: Not started\n\nNo existing task, quote, memorial or private note will be changed. A task proposal and your approval decision will be added to the private audit. Nothing will be sent.';
   canApply=true;
  }else if(a.kind==='quote'){
   record(a.draft,['row','quote','summary','notice']);
   const row=validateBackup({schemaVersion:1,memorial:{name:'',dates:'',story:'',service:'',message:'',portrait:''},privatePlan:{budget:'',tasks:[],quotes:[a.draft.row]}}).privatePlan.quotes[0];
   Object.values(row).forEach(v=>safeText(v));
   const expected=validateQuote(quoteFromLegacy(row,0,base.planning.jurisdiction));
   if(stable(a.draft.quote)!==stable(expected)||stable(a.draft.summary)!==stable(quoteSummary([expected])[0])||a.draft.notice!==AI_QUOTE_NOTICE)fail();
   preview='QUOTE DRAFT — REVIEW ONLY, NOT ADDED\n\n'+JSON.stringify(row,null,2)+'\n\nThis is unverified. Quote application is not supported by the current shared command layer. Nothing will be added or marked approved.';
  }else{
   record(a.draft,['category','text','notice']);const c=categories.find(c=>c.id===a.draft.category);
   if(!c||a.draft.text!==rfqTemplate(c,base.planning)||a.draft.notice!==AI_RFQ_NOTICE)fail();
   preview='RFQ DRAFT — REVIEW ONLY, NOT SAVED OR SENT\n\n'+safeText(a.draft.text,12000);
  }
  const review=Object.freeze({kind:a.kind,preview,canApply});
  reviews.set(review,{artifact:a,baseCanonical});return review;
 }catch(error){
  const allowed=/^(Choose an AI suggestion|AI suggestion is not valid|Unsupported AI draft version|This suggestion belongs|Only an unchanged pending|Unsafe or invalid suggestion|Secure local hashing)/;
  throw Error(allowed.test(error.message)?error.message:'Invalid or unsupported AI suggestion. Current work is unchanged.');
 }
}
export function discardAiReview(review){reviews.delete(review);}
export function applyReviewedTask(review,current){
 const saved=reviews.get(review);if(!saved||!review.canApply||saved.artifact.kind!=='task')fail('No approved task review is ready. Current work is unchanged.');
 // Synchronous final check closes the hashing/preview-to-approval race. The token cannot be serialized or forged.
 const base=normalize(current);
 if(canonicalWorkspace(base)!==saved.baseCanonical)fail('The plan changed after preview. Review a fresh suggestion before approving.');
 const command=saved.artifact.draft.command;
 const proposed=proposeCommand(base,command);validatePlanning(proposed.planning);
 const next=decideProposal(proposed,{id:command.id,expectedRevision:proposed.planning.revision,decision:'approved'});
 validateBackup({schemaVersion:2,...next});reviews.delete(review);return next;
}
