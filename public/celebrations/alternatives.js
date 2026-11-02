import {optionLinkCurrent} from './scope-budget.js';
// Explicit organiser-declared alternatives. No inferred exclusivity, identity, booking or ranking.
import {validateOptions,validateOptionLinks,reviewOption,linkOption,unlinkOption} from './options.js';
import {validateResponses,responseCurrency} from './responses.js';
import {budget} from './model.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function fail(s){throw Error(s);}
export function declaredAlternatives(o,ids){
 validateOptions(o.options,o.gatherings);validateOptionLinks(o.optionLinks,o.options);validateResponses(o.responses,o);
 if(!Array.isArray(ids)||ids.length<2||ids.length>10||new Set(ids).size!==ids.length)fail('Declare between two and ten distinct alternatives.');
 const rows=ids.map(id=>o.options.find(x=>x.id===id));if(rows.some(x=>!x))fail('An alternative is no longer in this occasion.');
 if(new Set(rows.map(x=>x.gatheringId)).size!==1)fail('Declare alternatives for the same gathering only.');
 return rows.map(x=>{
  const latest=o.responses.filter(r=>r.input.optionId===x.id).at(-1),g=o.gatherings.find(g=>g.id===x.gatheringId);
  const responseCurrent=!!latest&&latest.afterSource===JSON.stringify(x)&&latest.gatheringSource===JSON.stringify(g);
  return {option:structuredClone(x),link:structuredClone(o.optionLinks.find(l=>l.optionId===x.id)||null),response:latest?structuredClone(latest.input):null,responseCurrent};
 });
}
function resultFor(o,ids,chosenId){
 const rows=declaredAlternatives(o,ids);if(!rows.some(r=>r.option.id===chosenId))fail('Choose one of the explicitly declared alternatives.');
 let next=structuredClone(o);
 for(const id of ids)if(next.optionLinks.some(l=>l.optionId===id))next=unlinkOption(next,id);
 next=linkOption(next,reviewOption(next,chosenId),{currencyAcknowledged:true});
 // Check the final retained link set, not the alternatives deliberately removed.
 const currencies=new Set(next.optionLinks.filter(l=>optionLinkCurrent(next,l)).map(l=>responseCurrency(next,l.optionId)).filter(Boolean));
 if(currencies.size>1)fail('Remaining active links have different reported currencies. Review them separately; no conversion or combined total is available.');
 return next;
}
export function alternativeBudget(o){
 const b=budget(o),active=o.optionLinks.filter(l=>optionLinkCurrent(o,l));
 const codes=active.map(l=>{const x=o.options.find(x=>x.id===l.optionId),h=o.responses.filter(r=>r.input.optionId===l.optionId).at(-1),g=o.gatherings.find(g=>g.id===x.gatheringId);return h&&h.afterSource===JSON.stringify(x)&&h.gatheringSource===JSON.stringify(g)&&h.input.priceBasis==='quoted'?h.input.currency:'';});
 const currency=new Set(codes.filter(Boolean)),knownCurrency=currency.size===1&&!codes.includes('')&&o.costs.length===0;
 return {recordedSubtotalMinor:knownCurrency?b.total:null,currency:knownCurrency?[...currency][0]:'',unknownAmounts:b.unknown,staleLinks:b.staleCount,manualRows:o.costs.length,activeLinks:active.length,completeTotalKnown:false};
}
export function reviewAlternativeChoice(o,ids,chosenId){
 const rows=declaredAlternatives(o,ids),next=resultFor(o,ids,chosenId);
 return {occasionId:o.id,source:JSON.stringify(o),ids:[...ids],chosenId,removedLinks:rows.filter(r=>r.link).map(r=>r.option.id),retainedLinks:o.optionLinks.filter(l=>!ids.includes(l.optionId)).map(l=>l.optionId),beforeBudget:alternativeBudget(o),afterBudget:alternativeBudget(next)};
}
export function applyAlternativeChoice(o,review,{currencyAcknowledged=false}={}){
 if(currencyAcknowledged!==true)fail('Explicitly check that every retained amount uses one consistent currency before switching.');
 if(!review||review.occasionId!==o.id||review.source!==JSON.stringify(o))fail('The occasion changed. Review the exact alternatives again.');
 const fresh=reviewAlternativeChoice(o,review.ids,review.chosenId);if(!same(fresh,review))fail('The alternatives preview changed. Review it again.');
 return resultFor(o,review.ids,review.chosenId);
}
