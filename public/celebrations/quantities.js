// Non-identifying organiser planning quantities, not confirmed attendance or orders.
export function defaultQuantities(){return {headcount:'',seats:'',meals:'',revision:0};}
export function quantity(v){if(typeof v!=='string'||!(v===''||/^(0|[1-9]\d{0,4})$/.test(v))||v!==''&&Number(v)>10000)throw Error('Use a whole number from 0 to 10000, or leave unknown blank.');return v===''?null:Number(v);}
export function validateQuantities(q){if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).length!==4||['headcount','seats','meals','revision'].some(k=>!Object.hasOwn(q,k)))throw Error('Planning quantities have missing or unknown fields.');for(const k of ['headcount','seats','meals'])quantity(q[k]);if(!Number.isSafeInteger(q.revision)||q.revision<0)throw Error('Quantity revision is invalid.');return structuredClone(q);}
export function setQuantities(o,gatheringId,input){
 if(!input||Object.keys(input).length!==3||['headcount','seats','meals'].some(k=>!Object.hasOwn(input,k)))throw Error('Enter exactly the three planning quantities.');
 const g=o.gatherings.find(g=>g.id===gatheringId);if(!g)throw Error('Choose a current gathering in this occasion.');
 const old=validateQuantities(g.quantities);for(const k of ['headcount','seats','meals'])quantity(input[k]);
 const changed=['headcount','seats','meals'].some(k=>old[k]!==input[k]);if(!changed)return structuredClone(o);
 if(old.revision===Number.MAX_SAFE_INTEGER)throw Error('Quantity revision limit reached.');
 const next=structuredClone(o);next.gatherings.find(g=>g.id===gatheringId).quantities={...input,revision:old.revision+1};
 const affected=new Set(next.options.filter(x=>x.gatheringId===gatheringId).map(x=>x.id));
 for(const link of next.optionLinks)if(affected.has(link.optionId))link.invalidated=true;
 next.journey.completedCues=[];return next;
}
export function quantityBrief(g){
 const q=validateQuantities(g.quantities),label=v=>v===''?'Unknown':v;
 return 'Planning quantities for one gathering (organiser estimates, not confirmed attendance or an order):\nExpected attendees: '+label(q.headcount)+'\nPlanned available seats: '+label(q.seats)+'\nPlanned meal portions: '+label(q.meals)+'\nDo not assume everyone needs a seat or meal. Please clarify capacity, quantities, inclusions, mandatory extras and complete event price. Availability and total cost are unconfirmed.';
}
export function quantityAdvisories(g){
 const q=validateQuantities(g.quantities),n=quantity(q.headcount),seats=quantity(q.seats),meals=quantity(q.meals),out=[];
 if(n===null)out.push('Expected attendance is unknown; clarify a planning quantity before relying on capacity or per-person costs.');
 if(n!==null&&seats!==null&&seats<n)out.push('If everyone needs a seat, planned seats are '+(n-seats)+' below expected attendees. Check your arrangements; this is not an error or a capacity verification.');
 if(n!==null&&meals!==null&&meals<n)out.push('If everyone needs one meal portion, planned portions are '+(n-meals)+' below expected attendees. Check whether meals are intended; do not assume every person needs one.');
 if(q.seats==='')out.push('Seats are not specified. Decide whether seating needs to be arranged.');
 if(q.meals==='')out.push('Meal portions are not specified. Decide whether food quantities need to be arranged.');
 return out;
}
