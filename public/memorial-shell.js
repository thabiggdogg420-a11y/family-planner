import {prioritizeUnfinishedTasks} from './outcomes-model.js';
// Presentation-only routing. No private content is ever written into the URL.
const shellBridge=window.familyFramesPlanning;
const shellScreens=[...document.querySelectorAll('[data-screen]')];
const shellLinks=[...document.querySelectorAll('[data-nav]')];
const shellRoutes=new Set(shellScreens.map(n=>n.dataset.screen));
const shellParents={comparison:'costs',afterward:'plan',montage:'remember',sequence:'remember',rehearse:'remember',guided:'plan',outcomes:'plan',words:'remember',portrait:'remember',service:'remember',keepsake:'remember',photos:'remember',tasks:'more',settings:'more',backup:'more',offline:'more',ai:'more',about:'more'};
const shellSubscribers=[];
function workflowStage(stage){for(const link of document.querySelectorAll('[data-stage]')){if(link.dataset.stage===stage)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');}}
function routeStage(route){if(route==='rehearse')return 'rehearse';if(route==='montage')return 'create';if(route==='guided/ready'||['keepsake'].includes(route)||['outcomes/pack','outcomes/invitation','outcomes/runsheet','outcomes/helper'].includes(route))return 'create';return 'plan';}
let shellRoute='home';
function normalizedRoute(value){const route=String(value||'home').replace(/^#/,'');const first=route.split('/')[0];return shellRoutes.has(first)?(['plan','outcomes','guided'].includes(first)?route:first):'home';}
function renderRoute({initial=false}={}){
 const route=normalizedRoute(location.hash);const screen=route.split('/')[0];
 if(shellRoute.split('/')[0]==='backup'&&screen!=='backup')shellBridge.cancelBackupReview?.();
 // Browser Back must not leave an approval dialog over an unrelated screen.
 for(const dialog of document.querySelectorAll('dialog[open]')){const event=new Event('cancel',{cancelable:true});dialog.dispatchEvent(event);if(dialog.open&&!event.defaultPrevented)dialog.close();}
 shellRoute=route;workflowStage(routeStage(route));
 for(const node of shellScreens)node.hidden=node.dataset.screen!==screen;
 const parent=shellParents[screen]||screen;
 for(const link of shellLinks){if(link.dataset.nav===parent)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 for(const listener of shellSubscribers)listener(route);
 if(!initial){document.getElementById('status').textContent='';const heading=document.querySelector('[data-screen="'+screen+'"] [data-route-heading]');(heading||document.getElementById('main')).focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 document.title='Plan4Free · '+({comparison:'Private cost-option comparison',afterward:'Private afterward handover',montage:'Local silent photo montage',sequence:'Private ceremony sequence',rehearse:'Rehearse your saved copies',home:'Your private workspace',plan:'Your plan',guided:'Guided start & ready pack',outcomes:'Your plan & outputs',remember:'Remember',costs:'Costs',more:'Your workspace',words:'Words & life story',portrait:'Portrait',service:'Order of service',keepsake:'Keepsake',tasks:'Private tasks',settings:'Saving & privacy',backup:'Private backup',offline:'App & offline',ai:'Your AI & MCP',photos:'Photo room',about:'All in one for free'}[screen]||'Your workspace');
}
window.familyFramesUI={setWorkflowStage:stage=>{if(['plan','create','rehearse'].includes(stage))workflowStage(stage);},getRoute:()=>shellRoute,subscribe:fn=>shellSubscribers.push(fn),navigate:route=>{const next=normalizedRoute(route);if(location.hash==='#'+next)renderRoute();else location.hash=next;},refresh:()=>renderRoute({initial:true})};
window.addEventListener('hashchange',()=>renderRoute());
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();document.getElementById('main').focus();});
const shellGet=id=>document.getElementById(id);
function updateHome(){
 const w=shellBridge.getWorkspace();const hasMemorial=Object.values(w.memorial).some(value=>typeof value==='string'&&value.trim());const task=prioritizeUnfinishedTasks(w.privatePlan.tasks).find(t=>t.task.trim()),hasTasks=w.privatePlan.tasks.length>0,allDone=hasTasks&&w.privatePlan.tasks.every(t=>t.status==='Done');
 shellGet('homeNextLabel').textContent=task?'YOUR NEXT RECORDED TASK':hasTasks?'YOUR RECORDED TASKS':hasMemorial?'YOUR MEMORIAL INFORMATION IS RECORDED':'NO RUSH. NO REQUIRED ORDER.';
 shellGet('homeNext').textContent=task?task.task:hasTasks?(allDone?'Your recorded tasks are marked Done.':'Review your task details.'):hasMemorial?'You have a starting point.':'Start with what matters to you.';
 shellGet('homeNextDetail').textContent=task?(task.owner?'With '+task.owner:'Choose who can help, or take it at your own pace.'):hasTasks?(allDone?'These are family-recorded statuses, not confirmation that arrangements or official steps are complete.':'An unfinished task has no recorded description. Add its details before deciding what to do next.'):hasMemorial?'Review your words or photograph, then make a programme, card or private working pack.':'Your plan starts blank. A few wishes or questions are enough.';
 shellGet('homeNextLink').textContent=task?'Review next tasks →':hasTasks?'Review recorded tasks →':hasMemorial?'Review what you can make →':'Start with what I know →';shellGet('homeNextLink').href=(task||hasTasks)?'#outcomes':hasMemorial?'#guided/ready':'#guided';
 shellGet('memoryName').textContent=w.memorial.name||'A story worth keeping';shellGet('memorySubtitle').textContent=w.memorial.dates||'Begin with a name, a few words, or a photograph.';
 for(const [id,photoClass]of [['memoryPortrait','memory-portrait'],['portraitDisplay','portrait-display']]){
  const node=shellGet(id);if(node.dataset.portrait===(w.memorial.portrait||''))continue;
  if(!node.dataset.empty)node.dataset.empty=node.innerHTML;
  node.dataset.portrait=w.memorial.portrait||'';
  if(w.memorial.portrait){const img=document.createElement('img');img.src=w.memorial.portrait;img.alt='Selected keepsake portrait';node.replaceChildren(img);}else node.innerHTML=node.dataset.empty;
 }
 shellGet('tasksEmpty').hidden=w.privatePlan.tasks.length>0;
 shellGet('quotesEmpty').hidden=w.privatePlan.quotes.length>0;
}
shellBridge.subscribe(updateHome);updateHome();renderRoute({initial:true});
// Add buttons keep the next field in view without changing the underlying workflow.
for(const [button,target]of [['addTask','tasks'],['addQuote','quotes']])shellGet(button).addEventListener('click',()=>{queueMicrotask(()=>document.querySelector('#'+target+' .entry:last-child input')?.focus());});
// The dedicated input is already labelled; decorative preview containers never announce duplicate content.
