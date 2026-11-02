import {validateQuantities} from './quantities.js';
// Local, user-entered, unverified response receipts. No transport, booking or payment capability.
import {validateOptions} from './options.js';
const clone=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function fail(message){const e=new Error(message);e.code='invalid';throw e;}
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail('Response has missing or unknown fields.');}
function text(v,max){if(typeof v!=='string'||v.length>max)fail('Response text is invalid or too long.');}
function id(v){if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(v))fail('Response identifier is invalid.');}
function date(v,optional=false){text(v,10);if(optional&&v==='')return;const d=new Date(v+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail('Use a real response date.');}
function inputRecord(v,o){
 exact(v,['responseId','occasionId','optionId','gatheringId','receivedOn','sourceKind','evidenceText','priceBasis','amount','currency','availability','inclusions','terms','expiry']);
 for(const k of ['responseId','occasionId','optionId','gatheringId'])id(v[k]);
 date(v.receivedOn);if(v.receivedOn>new Date().toISOString().slice(0,10))fail('Received date cannot be in the future.');date(v.expiry,true);
 if(!['user-note','email-excerpt','provider-document'].includes(v.sourceKind))fail('Unknown response source kind.');
 text(v.evidenceText,4000);if(!v.evidenceText.trim())fail('Record a minimal non-sensitive evidence excerpt.');
 for(const k of ['inclusions','terms'])text(v[k],2000);
 text(v.amount,20);text(v.currency,3);
 if(!['unknown','quoted'].includes(v.priceBasis))fail('Response price must be unknown or quoted.');
 if(v.priceBasis==='unknown'&&(v.amount!==''||v.currency!==''))fail('Unknown price must have no amount or currency.');
 if(v.priceBasis==='quoted'&&(!/^\d+(\.\d{1,2})?$/.test(v.amount)||!Number.isSafeInteger(Math.round(Number(v.amount)*100))||Number(v.amount)>1000000||!/^[A-Z]{3}$/.test(v.currency)))fail('Quoted price needs a valid amount and explicit three-letter currency label.');
 if(!['unknown','reported-available','reported-unavailable'].includes(v.availability))fail('Availability is reported only, never verified.');
 if(o&&(v.occasionId!==o.id||!o.options.some(x=>x.id===v.optionId)||!o.gatherings.some(x=>x.id===v.gatheringId)))fail('Response belongs to another occasion, option or gathering.');
 return clone(v);
}
function afterOption(before,input){return {...before,amount:input.amount,priceBasis:input.priceBasis,status:input.availability==='reported-unavailable'?'not-available':input.priceBasis==='quoted'||input.availability==='reported-available'?'awaiting':'researching',checkedOn:input.receivedOn};}
function actions(input){
 const result=['Review the unverified source excerpt; no booking or confirmation is recorded.'];
 if(input.priceBasis==='unknown')result.push('Clarify the complete price and currency.');
 else result.push('Verify '+input.currency+' matches every budget amount before explicitly reviewing and relinking; the budget has no currency model or conversion.');
 if(!input.inclusions.trim())result.push('Clarify inclusions, exclusions and the complete total.');
 result.push(input.terms.trim()?'Review the reported terms and cancellation conditions.':'Ask for terms and cancellation conditions.');
 if(input.availability==='unknown')result.push('Clarify availability for the intended date and time.');
 if(input.availability==='reported-available')result.push('Reported availability is not a reservation; clarify date, time and next steps.');
 if(input.availability==='reported-unavailable')result.push('Review alternatives; no alternative is selected automatically.');
 if(input.expiry&&input.expiry<input.receivedOn)result.push('Reported expiry already preceded receipt; obtain updated terms.');
 if(input.expiry)result.push('Review the reported expiry '+input.expiry+'; no validity or availability is guaranteed.');
 return result;
}
function captured(source,max){text(source,max);let v;try{v=JSON.parse(source);}catch{fail('Response capture is invalid.');}if(JSON.stringify(v)!==source)fail('Response capture must be exact.');return v;}
function gatheringRecord(g){
 exact(g,['id','title','date','time','venue','sequence',...(Object.hasOwn(g,'quantities')?['quantities']:[])]);if(Object.hasOwn(g,'quantities'))validateQuantities(g.quantities);id(g.id);text(g.title,300);text(g.venue,300);date(g.date,true);
 const time=v=>{text(v,5);if(v!==''&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v))fail('Captured time is invalid.');};time(g.time);
 if(!Array.isArray(g.sequence)||!g.sequence.length||g.sequence.length>50)fail('Captured sequence is invalid.');
 for(const r of g.sequence){exact(r,['time','activity','owner']);time(r.time);text(r.activity,300);text(r.owner,300);}
 return g;
}
export function defaultResponses(){return [];}
export function validateResponses(responses,o){
 if(!Array.isArray(responses)||responses.length>100)fail('Use up to 100 response receipts per occasion.');
 const seen=new Set();
 for(const h of responses){
  exact(h,['input','beforeSource','afterSource','gatheringSource','nextActions']);const input=inputRecord(h.input,o);
  if(seen.has(input.responseId))fail('Duplicate response ID.');seen.add(input.responseId);
  const g=gatheringRecord(captured(h.gatheringSource,200000)),before=captured(h.beforeSource,40000),after=captured(h.afterSource,40000);
  validateOptions([before],[g]);validateOptions([after],[g]);
  if(g.id!==input.gatheringId||before.id!==input.optionId||after.id!==input.optionId||!same(after,afterOption(before,input))||!same(h.nextActions,actions(input)))fail('Response history does not match its captured change.');
 }
 return clone(responses);
}
export function reviewResponse(o,input){
 const value=inputRecord(input,o),history=validateResponses(o.responses,o),prior=history.find(x=>x.input.responseId===value.responseId);
 if(prior&&!same(prior.input,value))fail('Response ID already has different content. Nothing was replaced.');
 const before=validateOptions(o.options,o.gatherings).find(x=>x.id===value.optionId),g=o.gatherings.find(x=>x.id===value.gatheringId);
 if(!prior&&before.gatheringId!==value.gatheringId)fail('Response does not match the option gathering.');
 return {occasionId:o.id,occasionSource:JSON.stringify(o),input:value,before:clone(before),after:prior?clone(before):afterOption(before,value),nextActions:actions(value),duplicate:!!prior};
}
export function applyResponse(o,review){
 exact(review,['occasionId','occasionSource','input','before','after','nextActions','duplicate']);
 if(review.occasionId!==o.id||review.occasionSource!==JSON.stringify(o))fail('Occasion changed since response review. Review it again.');
 const fresh=reviewResponse(o,review.input);if(!same(fresh,review))fail('Response review changed. Review it again.');
 const next=clone(o);if(fresh.duplicate)return next;if(next.responses.length>=100)fail('Response receipt limit reached.');
 next.options=next.options.map(x=>x.id===fresh.input.optionId?clone(fresh.after):x);
 next.optionLinks=next.optionLinks.map(x=>x.optionId===fresh.input.optionId?{...x,invalidated:true}:x);
 next.responses.push({input:clone(fresh.input),beforeSource:JSON.stringify(fresh.before),afterSource:JSON.stringify(fresh.after),gatheringSource:JSON.stringify(o.gatherings.find(g=>g.id===fresh.input.gatheringId)),nextActions:clone(fresh.nextActions)});
 validateResponses(next.responses,next);return next;
}

export function responseCurrency(o,optionId){
 validateResponses(o.responses,o);
 const receipt=o.responses.filter(h=>h.input.optionId===optionId).at(-1);
 return receipt?.input.priceBasis==='quoted'?receipt.input.currency:'';
}
