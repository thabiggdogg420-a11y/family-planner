import {validateMoneyFollowups} from './money-followups.js';
import {defaultQuantities,validateQuantities} from './quantities.js';
import {validateHelperResponses} from './helper-responses.js';
import {validateResponses} from './responses.js';
import {defaultResearch,validateResearch} from './research.js';
import {hasPack,getPack} from './packs.js';
import {defaultJourney,validateJourney} from './journey.js';
import {validateOptions,validateOptionLinks} from './options.js';
// Browser-local, opt-in manual saving only. No transport, downloads, contacts or automatic restore.
export const STORAGE_KEY='family-planner.public-celebrations.v1';
export const LOCK_NAME='family-planner.public-celebrations.v1.write';
const clone=v=>JSON.parse(JSON.stringify(v));
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail('invalid','Stored draft has missing or unknown fields.');}
function text(v,max=2000){if(typeof v!=='string'||v.length>max)fail('invalid','Stored draft text is invalid.');}
function rows(v,min,max){if(!Array.isArray(v)||v.length<min||v.length>max)fail('invalid','Stored draft collection is invalid.');}
function ids(v){if(v.some(x=>!x||typeof x!=='object'||Array.isArray(x)))fail('invalid','Stored draft record is invalid.');if(new Set(v.map(x=>x.id)).size!==v.length)fail('invalid','Stored draft contains duplicate identifiers.');}
function id(v){if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(v))fail('invalid','Stored draft identifier is invalid.');}
function amount(v){text(v,20);if(v!==''&&(!/^\d+(\.\d{1,2})?$/.test(v)||Number(v)>1000000))fail('invalid','Stored draft amount is invalid.');}
function date(v){text(v,10);if(v==='')return;const d=new Date(v+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail('invalid','Stored draft date is invalid.');}
function time(v){text(v,5);if(v!==''&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v))fail('invalid','Stored draft time is invalid.');}
// Version 1 can contain original task records or historical plain-text tasks.
// Migration changes no existing text, status or ID, and never writes storage.
function migrateTasks(tasks){
 rows(tasks,0,50);const used=new Set();
 for(const t of tasks){if(typeof t==='string'){text(t,300);continue;}exact(t,['id','text','done']);id(t.id);text(t.text,300);if(typeof t.done!=='boolean')fail('invalid','Stored task status is invalid.');if(used.has(t.id))fail('invalid','Stored draft contains duplicate identifiers.');used.add(t.id);}
 return tasks.map((t,i)=>{if(typeof t!=='string')return {...t,owner:'',due:'',gatheringId:''};let generated=`legacy-task-${i}`,suffix=0;while(used.has(generated))generated=`legacy-task-${i}-${++suffix}`;used.add(generated);return {id:generated,text:t,done:false,owner:'',due:'',gatheringId:''};});
}
function validateVersionData(data,version){
 exact(data,['occasions','active']);rows(data.occasions,1,12);id(data.active);
 // Copy only after validating container shape; all field validation is below.
 let out;try{out=structuredClone(data);}catch{fail('invalid','Stored draft must contain plain planning data.');}ids(out.occasions);
 for(const o of out.occasions){
  exact(o,['id','type','title','subjects','intention','roles','practical','budgetLimit','costs','tasks','gatherings',...(version>=3?['options']:[]),...(version>=4?['optionLinks']:[]),...(version>=5?['journey']:[]),...(version>=7?['research']:[]),...(version>=8?['responses']:[]),...(version>=9?['helperResponses']:[]),...(version>=12?['moneyFollowups']:[])]);id(o.id);
  if(!hasPack(o.type)||version<getPack(o.type).introducedVersion)fail('invalid','Unsupported occasion pack.');
  for(const k of ['title','subjects'])text(o[k],300);for(const k of ['intention','roles','practical'])text(o[k]);amount(o.budgetLimit);
  rows(o.costs,0,50);for(const c of o.costs){exact(c,['label','amount']);text(c.label,300);amount(c.amount);}
  rows(o.gatherings,1,12);ids(o.gatherings);
  for(const g of o.gatherings){exact(g,['id','title','date','time','venue','sequence',...(version>=11?['quantities']:[])]);if(version<11)g.quantities=defaultQuantities();g.quantities=validateQuantities(g.quantities);id(g.id);text(g.title,300);text(g.venue,300);date(g.date);time(g.time);rows(g.sequence,1,50);for(const r of g.sequence){exact(r,['time','activity','owner']);time(r.time);text(r.activity,300);text(r.owner,300);}}
  if(version<3)o.options=[];o.options=validateOptions(o.options,o.gatherings);
  if(version<5)o.journey=defaultJourney();else if(version===5){exact(o.journey,['scale','setting','stage','completedCues','wrapDone']);o.journey={...o.journey,ceremony:'undecided'};}o.journey=validateJourney(o.journey,o.type);
  if(version<4)o.optionLinks=[];o.optionLinks=validateOptionLinks(o.optionLinks,o.options);
  if(version<7)o.research=defaultResearch();o.research=validateResearch(o.research,o);
  if(version<8)o.responses=[];o.responses=validateResponses(o.responses,o);if(version<11){const reported=new Set(o.responses.map(r=>r.input.optionId));for(const link of o.optionLinks)if(reported.has(link.optionId))link.invalidated=true;}
  if(version<9)o.helperResponses=[];if(version<12)o.moneyFollowups=[];o.moneyFollowups=validateMoneyFollowups(o.moneyFollowups,o);
  if(version===1)o.tasks=migrateTasks(o.tasks);
  rows(o.tasks,0,50);ids(o.tasks);
  for(const t of o.tasks){exact(t,['id','text','done','owner','due','gatheringId']);id(t.id);text(t.text,300);if(typeof t.done!=='boolean')fail('invalid','Stored task status is invalid.');text(t.owner,300);date(t.due);text(t.gatheringId,80);if(t.gatheringId!==''&&!o.gatherings.some(g=>g.id===t.gatheringId))fail('invalid','Task gathering must belong to its own occasion.');}
 }
 for(const o of out.occasions)o.helperResponses=validateHelperResponses(o.helperResponses,o);
 if(!out.occasions.some(o=>o.id===out.active))fail('invalid','Stored active occasion is missing.');return out;
}
export function validateData(data){return validateVersionData(data,12);}
export function parseSnapshot(raw){
 if(typeof raw!=='string'||raw.length>1000000)fail('invalid','Stored draft is invalid or too large.');let s;try{s=JSON.parse(raw);}catch{fail('invalid','Stored draft cannot be read.');}
 exact(s,['format','version','revision','data']);if(s.format!=='family-occasions-private-draft'||![1,2,3,4,5,6,7,8,9,10,11,12].includes(s.version))fail('version','Stored draft format/version is not supported.');id(s.revision);
 return {...s,version:12,data:validateVersionData(s.data,s.version)};
}
export function createRetention({storage,locks,newRevision}){
 function read(){try{const raw=storage.getItem(STORAGE_KEY);return raw===null?null:parseSnapshot(raw);}catch(e){if(typeof e.code==='string')throw e;fail('storage','This browser cannot read local draft storage.');}}
 async function transaction(expected,operation){if(!locks||typeof locks.request!=='function')fail('unsupported','Safe local saving is unavailable in this browser. Continue session-only.');return locks.request(LOCK_NAME,{mode:'exclusive'},async()=>{const current=read();if((current?.revision??null)!==expected)fail('conflict','Another tab changed the stored draft. Nothing was overwritten or cleared. Check the stored draft before choosing what to do.');return operation(current);});}
 return {read,
  inspect(){let raw;try{raw=storage.getItem(STORAGE_KEY);}catch{fail('storage','This browser cannot read local draft storage.');}if(raw===null)return {raw:null,snapshot:null,error:null};try{return {raw,snapshot:parseSnapshot(raw),error:null};}catch(error){return {raw,snapshot:null,error:error.message};}},
  async clearInspected(raw){if(!locks||typeof locks.request!=='function')fail('unsupported','Safe local clearing is unavailable. Use browser site-data settings if you need to remove stored details.');return locks.request(LOCK_NAME,{mode:'exclusive'},async()=>{let current;try{current=storage.getItem(STORAGE_KEY);}catch{fail('storage','Cannot read stored draft to clear safely.');}if(current!==raw)fail('conflict','Stored draft changed since review. Nothing was cleared; check it again.');try{storage.removeItem(STORAGE_KEY);if(storage.getItem(STORAGE_KEY)!==null)fail('storage','Local clearing could not be verified.');}catch(e){if(typeof e.code==='string')throw e;fail('storage','Could not clear local storage. Stored details may remain.');}return true;});},
  async save(data,expected){const checked=validateData(data);return transaction(expected,()=>{const revision=newRevision();id(revision);if(revision===expected)fail('invalid','Could not create a fresh draft revision.');const snapshot={format:'family-occasions-private-draft',version:12,revision,data:checked},raw=JSON.stringify(snapshot);if(raw.length>1000000)fail('invalid','Draft is too large for local saving.');try{storage.setItem(STORAGE_KEY,raw);if(storage.getItem(STORAGE_KEY)!==raw)fail('storage','Local save could not be verified. Keep this session open.');}catch(e){if(typeof e.code==='string')throw e;fail('storage','Local save failed (storage blocked or full). Keep this session open; changes are not confirmed saved.');}return clone(snapshot);});},
  async clear(expected){return transaction(expected,()=>{try{storage.removeItem(STORAGE_KEY);if(storage.getItem(STORAGE_KEY)!==null)fail('storage','Local clearing could not be verified.');}catch(e){if(typeof e.code==='string')throw e;fail('storage','Could not clear local storage. Stored details may remain on this browser.');}return true;});}
 };
}
