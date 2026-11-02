// Organiser-entered planning ledger only. No bank connection, transfer, advice or verified settlement.
const clone=x=>structuredClone(x),fields=['kind','label','gatheringId','total','currency','dueOn','note','settlements'];
function fail(s){const e=Error(s);e.code='invalid';throw e;}
function exact(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))fail('Money record has missing or unknown fields.');}
function text(v,max){if(typeof v!=='string'||v.length>max)fail('Money text is invalid or too long.');}
function id(v){if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(v))fail('Money reference is invalid.');}
function date(v,optional=false){if(optional&&v==='')return;text(v,10);const d=new Date(v+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)fail('Enter a real calendar date.');}
export function decimalUnits(v,{optional=false}={}){
 if(optional&&v==='')return null;
 if(typeof v!=='string'||!/^(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(v))fail('Use an exact non-negative decimal, up to 9 whole and 6 fractional digits; no separators, exponent or rounding.');
 const [a,b='']=v.split('.');return BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));
}
export function decimalText(units){if(typeof units!=='bigint'||units<0n)fail('Money result is invalid.');const whole=units/1000000n,part=(units%1000000n).toString().padStart(6,'0').replace(/0+$/,'');return whole.toString()+(part?'.'+part:'');}
function version(v,o){
 exact(v,fields);if(!['payment','refund'].includes(v.kind))fail('Choose payment or refund follow-up.');
 text(v.label,300);if(!v.label.trim())fail('Use a planning label, not account or personal details.');text(v.gatheringId,80);if(v.gatheringId)id(v.gatheringId);
 if(o&&v.gatheringId&&!o.gatherings.some(g=>g.id===v.gatheringId))fail('Money scope must belong to this occasion.');
 const total=decimalUnits(v.total,{optional:true});text(v.currency,3);if(v.currency!==''&&!/^[A-Z]{3}$/.test(v.currency))fail('Use a three-letter uppercase currency label or leave unknown blank.');
 date(v.dueOn,true);text(v.note,2000);
 if(!Array.isArray(v.settlements)||v.settlements.length>30)fail('Use up to thirty reported amounts per follow-up.');
 let sum=0n;for(const s of v.settlements){exact(s,['amount','on','note']);sum+=decimalUnits(s.amount);date(s.on);if(s.on>new Date().toISOString().slice(0,10))fail('Reported settlement date cannot be in the future.');text(s.note,1000);}
 if(v.settlements.length&&!v.currency)fail('Record a currency label before reporting amounts; no conversion is available.');
 if(total!==null&&sum>total)fail('Reported amounts exceed the recorded total. Nothing changed. Review the total or explicitly correct reported amounts; no overpayment is inferred.');
 return clone(v);
}
export function validateMoneyFollowups(rows,o){
 if(!Array.isArray(rows)||rows.length>50)fail('Use up to fifty money follow-ups.');const seen=new Set();
 for(const row of rows){exact(row,['id','versions']);id(row.id);if(seen.has(row.id))fail('Duplicate money follow-up reference.');seen.add(row.id);if(!Array.isArray(row.versions)||!row.versions.length||row.versions.length>30)fail('Money history is missing or full.');for(const v of row.versions)version(v,o);}
 return clone(rows);
}
export function moneyProgress(v){
 version(v);const total=decimalUnits(v.total,{optional:true}),reported=v.settlements.reduce((n,s)=>n+decimalUnits(s.amount),0n),known=total!==null&&!!v.currency;
 return {total:v.total,reported:decimalText(reported),remaining:known?decimalText(total-reported):null,currency:v.currency,covered:known&&total===reported&&v.settlements.length>0,unknown:!known};
}
export function currentMoney(o,rowId){validateMoneyFollowups(o.moneyFollowups,o);const row=o.moneyFollowups.find(x=>x.id===rowId);if(!row)fail('Choose a current money follow-up.');return {row,value:clone(row.versions.at(-1))};}
function proposed(o,action){
 exact(action,['kind','rowId','input','index']);id(action.rowId);const rows=validateMoneyFollowups(o.moneyFollowups,o);let next;
 if(action.kind==='create'){exact(action.input,fields.filter(k=>k!=='settlements'));if(rows.some(r=>r.id===action.rowId)||rows.length>=50)fail('Money reference already exists or list is full.');if(action.index!==null)fail('New follow-up index is invalid.');next=version({...action.input,settlements:[]},o);}
 else {
  const {row,value}=currentMoney(o,action.rowId);if(row.versions.length>=30)fail('History limit reached; no record overwritten.');
  if(action.kind==='edit'){if(action.index!==null)fail('Edit index is invalid.');exact(action.input,fields.filter(k=>k!=='settlements'));if(value.settlements.length&&(action.input.currency!==value.currency||action.input.kind!==value.kind||action.input.gatheringId!==value.gatheringId))fail('Explicitly remove reported amounts before changing currency, direction or scope; their history will remain.');if(action.input.total!==value.total&&!action.input.note.trim())fail('Explain the total correction in a minimal redacted note.');next=version({...action.input,settlements:value.settlements},o);}
  else if(action.kind==='report'){if(action.index!==null)fail('New report index is invalid.');next=version({...value,settlements:[...value.settlements,action.input]},o);}
  else if(action.kind==='correct'||action.kind==='remove'){
   if(!Number.isInteger(action.index)||action.index<0||action.index>=value.settlements.length)fail('Reported amount changed or no longer exists.');
   if(action.kind==='remove'){exact(action.input,['reason']);text(action.input.reason,1000);if(!action.input.reason.trim())fail('Explain why this reported amount needs removing; this is not a payment reversal.');}if(action.kind==='correct'&&!action.input?.note?.trim())fail('Explain this correction in the report note.');
   const settlements=value.settlements.map(clone);if(action.kind==='remove')settlements.splice(action.index,1);else settlements[action.index]=action.input;next=version({...value,settlements,...(action.kind==='remove'?{note:value.note+(value.note?'\n':'')+'Organiser correction: '+action.input.reason}:{})},o);
  }else fail('Unknown money action.');
 }
 return next;
}
export function reviewMoney(o,action){const after=proposed(o,action),before=action.kind==='create'?null:currentMoney(o,action.rowId).value;return {occasionId:o.id,source:JSON.stringify(o),action:clone(action),before,after,progress:moneyProgress(after)};}
export function applyMoney(o,review){
 exact(review,['occasionId','source','action','before','after','progress']);if(review.occasionId!==o.id||review.source!==JSON.stringify(o))fail('The plan changed. Review this exact money record again.');
 const fresh=reviewMoney(o,review.action);if(JSON.stringify(fresh)!==JSON.stringify(review))fail('Money preview changed. Review again.');
 const next=clone(o),row=next.moneyFollowups.find(x=>x.id===review.action.rowId);
 if(row)row.versions.push(clone(fresh.after));else next.moneyFollowups.push({id:review.action.rowId,versions:[clone(fresh.after)]});
 validateMoneyFollowups(next.moneyFollowups,next);return next;
}
export function moneySummary(o){
 validateMoneyFollowups(o.moneyFollowups,o);const groups=new Map();let unknown=0;
 for(const row of o.moneyFollowups){const v=row.versions.at(-1),p=moneyProgress(v);if(p.remaining===null){unknown++;continue;}const key=v.kind+':'+v.currency,g=groups.get(key)||{kind:v.kind,currency:v.currency,remaining:0n};g.remaining+=decimalUnits(p.remaining);groups.set(key,g);}
 return {unknown,groups:[...groups.values()].map(x=>({...x,remaining:decimalText(x.remaining)}))};
}
