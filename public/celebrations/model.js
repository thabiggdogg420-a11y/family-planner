import {optionLinkCurrent} from './scope-budget.js';
import {defaultQuantities} from './quantities.js';
import {defaultResearch} from './research.js';
import {defaultJourney} from './journey.js';
import {packs,hasPack} from './packs.js';
export {packs} from './packs.js';
export function occasion(id,type){if(!hasPack(type))throw Error('Choose a supported occasion.');return {id,type,title:`New ${packs[type].name.toLowerCase()}`,subjects:'',intention:'',roles:'',practical:'',budgetLimit:'',costs:[],options:[],optionLinks:[],journey:defaultJourney(),research:defaultResearch(),responses:[],helperResponses:[],moneyFollowups:[],tasks:packs[type].tasks.map((text,i)=>({id:`task-${i}`,text,done:false,owner:'',due:'',gatheringId:''})),gatherings:packs[type].gatheringTitles.map((title,i)=>gathering(`gathering-${i+1}`,title))};}
export function gathering(id,title='Another gathering'){return {id,title,date:'',time:'',venue:'',quantities:defaultQuantities(),sequence:[{time:'',activity:'Welcome and settle in',owner:''}]};}
export function money(value){if(value==='')return null;if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw Error('Enter a positive amount or zero, with up to two decimals.');const n=Math.round(Number(value)*100);if(!Number.isSafeInteger(n)||n>100000000)throw Error('Amount is too large for this prototype.');return n;}
export function budget(o){
 const manualTotal=o.costs.reduce((n,c)=>n+(money(c.amount)??0),0);let linkedTotal=0,staleCount=0,unknown=o.costs.filter(c=>c.amount==='').length;
 const seen=new Set();for(const link of o.optionLinks??[]){if(seen.has(link.optionId))throw Error('Duplicate option link.');seen.add(link.optionId);const selected=o.options?.find(x=>x.id===link.optionId);if(!optionLinkCurrent(o,link)){staleCount++;continue;}const n=money(selected.amount);if(n===null)unknown++;else linkedTotal+=n;}
 const total=manualTotal+linkedTotal,limit=money(o.budgetLimit);return {total,limit,remaining:limit===null?null:limit-total,unknown,linkedTotal,staleCount};
}
export function replaceOccasion(list,id,next){if(next.id!==id||!list.some(o=>o.id===id))throw Error('Unknown occasion.');return list.map(o=>o.id===id?structuredClone(next):o);}
// Blank public start. No private development examples or stored records are copied.
export function demo(){return [occasion('occasion-1','birthday')];}
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
function validTime(v){return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);}
export function missing(o){return [packs[o.type].subjectsRequired&&!o.subjects.trim()&&'People being celebrated',...o.gatherings.flatMap((g,i)=>[!validDate(g.date)&&`Gathering ${i+1}: date`,!validTime(g.time)&&`Gathering ${i+1}: start time`,!g.venue.trim()&&`Gathering ${i+1}: venue`])].filter(Boolean);}

export function option(id,gatheringId){return {id,gatheringId,kind:'venue',name:'',requirements:'',amount:'',priceBasis:'unknown',status:'researching',checkedOn:'',notes:''};}
