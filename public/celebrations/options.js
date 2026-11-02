import {optionLinkCurrent} from './scope-budget.js';
// Organiser-entered alternatives only: no supplier verification or booking. Budget linking requires an explicit reviewed decision.
import {money} from './model.js';
export {option} from './model.js';
const keys=['id','gatheringId','kind','name','requirements','amount','priceBasis','status','checkedOn','notes'];
function invalid(message){const e=new Error(message);e.code='invalid';throw e;}
function text(v,max){if(typeof v!=='string'||v.length>max)invalid('Option text is missing or too long.');}
function id(v){if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(v))invalid('Option identifiers are invalid.');}
function date(v){text(v,10);if(v==='')return;const d=new Date(v+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)invalid('Enter a real option check date.');}
function record(o){
 if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))invalid('Option has missing or unknown fields.');
 id(o.id);id(o.gatheringId);if(!['venue','supplier'].includes(o.kind))invalid('Choose venue or supplier.');
 text(o.name,300);text(o.requirements,2000);text(o.notes,2000);text(o.amount,20);
 if(!['unknown','estimate','quoted'].includes(o.priceBasis))invalid('Choose unknown, estimate or quoted price basis.');
 try{money(o.amount);}catch{invalid('Option amount is invalid.');}
 if(o.priceBasis==='unknown'&&o.amount!=='')invalid('Unknown price must have no amount.');
 if(o.priceBasis!=='unknown'&&o.amount==='')invalid('Estimated or quoted prices need an amount (zero is allowed).');
 if(!['researching','awaiting','organiser-confirmed','not-available'].includes(o.status))invalid('Option status is invalid.');
 date(o.checkedOn);if(o.status==='organiser-confirmed'&&o.checkedOn==='')invalid('An organiser-confirmed option needs a check date.');
 return {...o};
}
export function validateOptions(options,gatherings){
 if(!Array.isArray(options)||options.length>50)invalid('Use up to 50 options per occasion.');
 if(!Array.isArray(gatherings))invalid('Option gathering context is missing.');
 const checked=options.map(record);if(new Set(checked.map(o=>o.id)).size!==checked.length)invalid('Option IDs must be unique within the occasion.');
 if(checked.some(o=>!gatherings.some(g=>g&&g.id===o.gatheringId)))invalid('Each option must belong to a gathering in its own occasion.');return checked;
}
export function optionSummary(options,gatheringId){
 if(!Array.isArray(options)||options.length>50)invalid('Use up to 50 options per occasion.');
 const checked=options.map(record);if(new Set(checked.map(o=>o.id)).size!==checked.length)invalid('Option IDs must be unique within the occasion.');
 if(gatheringId!==undefined)id(gatheringId);
 const selected=checked.filter(o=>gatheringId===undefined||o.gatheringId===gatheringId);
 return {count:selected.length,unknownCount:selected.filter(o=>o.priceBasis==='unknown').length,knownCount:selected.filter(o=>o.priceBasis!=='unknown').length,rows:selected.map(o=>({...o,amountMinor:money(o.amount),confirmationLabel:o.status==='organiser-confirmed'?'Organiser recorded confirmation — not independently verified':o.status==='not-available'?'Recorded as not available':o.status==='awaiting'?'Awaiting information':'Researching'}))};
}

export function validateOptionLinks(links,options){
 if(!Array.isArray(links)||links.length>50)invalid('Use up to 50 reviewed option links.');
 const seen=new Set();return links.map(link=>{
  if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).length!==3||!Object.hasOwn(link,'optionId')||!Object.hasOwn(link,'source')||!Object.hasOwn(link,'invalidated'))invalid('Option link has missing or unknown fields.');
  if(typeof link.invalidated!=='boolean')invalid('Option link invalidation flag is required.');
  id(link.optionId);if(seen.has(link.optionId))invalid('An option can be linked only once.');seen.add(link.optionId);
  if(!options.some(o=>o.id===link.optionId))invalid('Linked option no longer exists.');
  text(link.source,40000);let prior;try{prior=JSON.parse(link.source);}catch{invalid('Option link source is not a valid captured option.');}
  record(prior);if(prior.id!==link.optionId||JSON.stringify(prior)!==link.source)invalid('Option link must contain an exact captured option.');
  return {...link};
 });
}
export function reviewOption(o,optionId){
 const options=validateOptions(o.options,o.gatherings),selected=options.find(x=>x.id===optionId);if(!selected)invalid('Choose an option in this occasion.');
 return {occasionId:o.id,optionId,source:JSON.stringify(selected),copy:{...selected}};
}
export function linkOption(o,review,{currencyAcknowledged=false}={}){
 // Latest receipt wins, including an explicit reset to unknown. No currency conversion.
 const currencyFor=id=>{const receipt=(o.responses??[]).filter(h=>h.input?.optionId===id).at(-1);return receipt?.input.priceBasis==='quoted'?receipt.input.currency:'';};
 const currency=currencyFor(review?.optionId);
 const response=(o.responses??[]).filter(h=>h.input?.optionId===review?.optionId).at(-1),selected=o.options.find(x=>x.id===review?.optionId),scope=o.gatherings.find(g=>g.id===selected?.gatheringId);
 if(response&&response.gatheringSource!==JSON.stringify(scope))invalid('Gathering or planning quantities changed since this reported response. Record updated evidence for this scope before a new budget link.');

 if(currency){
  const latest=(o.responses??[]).filter(h=>h.input?.optionId===review?.optionId).at(-1);
  if(latest.input.expiry&&latest.input.expiry<new Date().toISOString().slice(0,10))invalid('This reported quote has expired. Record an updated response before linking it.');
  if(currencyAcknowledged!==true)invalid('Explicitly verify all plan amounts use '+currency+' before linking this response-backed quote.');
  for(const link of o.optionLinks??[]){
   const option=o.options.find(x=>x.id===link.optionId);
   if(optionLinkCurrent(o,link)){
    const other=currencyFor(link.optionId);
    if(other&&other!==currency)invalid('Mixed response currencies cannot be linked into one budget. No conversion is available.');
   }
  }
 }
 if(!review||typeof review!=='object'||Array.isArray(review)||Object.keys(review).length!==4||['occasionId','optionId','source','copy'].some(k=>!Object.hasOwn(review,k)))invalid('Review this option before linking it.');
 if(review.occasionId!==o.id)invalid('Option review belongs to another occasion.');
 const current=reviewOption(o,review.optionId);if(current.source!==review.source||JSON.stringify(review.copy)!==review.source)invalid('Option changed since review. Review it again before linking.');
 const links=validateOptionLinks(o.optionLinks,o.options);if(links.some(l=>l.optionId===review.optionId))invalid('Already linked. Explicitly unlink before reviewing a replacement.');
 const next=structuredClone(o);next.optionLinks=[...links,{optionId:review.optionId,source:current.source,invalidated:false}];return next;
}
export function unlinkOption(o,optionId){
 const links=validateOptionLinks(o.optionLinks,o.options);if(!links.some(l=>l.optionId===optionId))invalid('This option is not linked.');
 const next=structuredClone(o);next.optionLinks=links.filter(l=>l.optionId!==optionId);return next;
}
