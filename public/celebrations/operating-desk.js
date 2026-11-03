// Derived private desk. No new saved fields, messages, bookings or readiness verdict.
import {dayCues,wrapCues} from './journey.js';
import {quantityBrief,quantityAdvisories} from './quantities.js';
import {helperCoverage} from './helper-coverage.js';
import {optionLinkCurrent} from './scope-budget.js';
import {timingChecks} from './timing.js';
export function operatingDesk(o,gatheringId){
 const g=o.gatherings.find(g=>g.id===gatheringId);if(!g)throw Error('Choose a current gathering.');
 const tasks=o.tasks.filter(t=>!t.gatheringId||t.gatheringId===g.id),keys=new Set([...tasks.map(t=>'task:'+t.id),...g.sequence.map((_,i)=>`cue:${g.id}:${i}`)]);
 const index=o.gatherings.indexOf(g);
 return {occasionId:o.id,gatheringId:g.id,source:JSON.stringify(o),gathering:structuredClone(g),tasks:structuredClone(tasks),cues:dayCues(o),wrap:wrapCues(o),quantities:quantityBrief(g),advisories:quantityAdvisories(g),helpers:helperCoverage(o).filter(x=>keys.has(x.key)),options:o.options.filter(x=>x.gatheringId===g.id).map(x=>({...structuredClone(x),staleBudget:o.optionLinks.some(l=>l.optionId===x.id&&!optionLinkCurrent(o,l))})),timings:timingChecks(o).filter(x=>x.targets.some(t=>t.path.startsWith(`gatherings.${index}.`)))};
}
export function deskProgress(o,desk,kind,id,expected){
 if(!desk||desk.occasionId!==o.id||desk.source!==JSON.stringify(o)||JSON.stringify(operatingDesk(o,desk.gatheringId))!==JSON.stringify(desk))throw Error('Desk changed. Review the current gathering again.');
 if(typeof expected!=='boolean')throw Error('Review the current progress.');
 const next=structuredClone(o);
 if(kind==='task'){const t=desk.tasks.find(t=>t.id===id);if(!t||t.done!==expected)throw Error('Task changed or belongs to another gathering.');next.tasks.find(t=>t.id===id).done=!expected;}
 else {const items=kind==='cue'?desk.cues:kind==='wrap'?desk.wrap:null;if(!items)throw Error('Unknown progress control.');const c=items.find(c=>c.id===id);if(!c||c.done!==expected)throw Error('Cue changed.');const field=kind==='cue'?'completedCues':'wrapDone';next.journey[field]=next.journey[field].filter(x=>x!==id);if(!expected)next.journey[field].push(id);}
 return next;
}
export function deskRunSheet(o,desk){
 if(!desk||desk.source!==JSON.stringify(o)||JSON.stringify(operatingDesk(o,desk.gatheringId))!==JSON.stringify(desk))throw Error('Plan changed. Review a fresh organiser run sheet.');
 const g=desk.gathering,show=v=>v||'Unknown';
 return {filename:'private-organiser-run-sheet.txt',mime:'text/plain;charset=utf-8',text:['PLAN4FREE — PRIVATE ORGANISER RUN SHEET',o.title,g.title,`${show(g.date)} · ${show(g.time)} (venue-local; timezone not established)`,show(g.venue),'PRIVATE: contains task aliases, supplier notes and helper reports. Not a guest copy, invitation, confirmation or restorable backup. Static copy; earlier copies do not update.','',desk.quantities,...desk.advisories,'','TASKS — selected gathering plus whole occasion',...desk.tasks.map(t=>`${t.done?'[done]':'[ ]'} ${t.text} — ${t.gatheringId?'This gathering':'Whole occasion'}; alias: ${show(t.owner)}; due: ${show(t.due)}`),'','RUNNING ORDER — entered order, not live execution',...g.sequence.map((r,i)=>`${i+1}. ${show(r.time)} — ${show(r.activity)} — alias: ${show(r.owner)}`),'','TIMING PROMPTS',...desk.timings.map(x=>x.text),'','OCCASION-WIDE DAY CHECKS',...desk.cues.map(c=>`${c.done?'[done]':'[ ]'} ${c.text}`),'','OCCASION-WIDE WRAP-UP CHECKS',...desk.wrap.map(c=>`${c.done?'[done]':'[ ]'} ${c.text}`),'','SUPPLIER QUESTIONS — organiser records, not verified',...(desk.options.length?desk.options.flatMap(x=>[`${show(x.name)} — ${x.status}; checked: ${show(x.checkedOn)}${x.staleBudget?'; STALE budget link':''}`,`Requirements: ${show(x.requirements)}`,`Private notes: ${show(x.notes)}`]):['No supplier options recorded; arrangements remain unknown.']),'','HELPER ITEM SCOPES — aliases and reports do not establish acceptance',...desk.helpers.flatMap(h=>[`${h.label}: ${h.state}`,h.detail,...h.related.map(r=>`${r.heading}: ${r.status}; ${r.current?'current scope':'needs reconfirmation'}; whole report covers ${r.taskCount} task(s), ${r.cueCount} cue(s), possibly beyond this gathering.`)]),'','No sending, booking, payment or verified completion. Check arrangements privately.'].join('\n')};
}
