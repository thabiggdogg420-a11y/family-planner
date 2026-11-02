import {createRemovalSession} from './removal.js';
export function removalPreview({token,review:r},esc){
 const item=r.record,detail=r.kind==='task'?`<p class="preserve"><strong>${esc(item.text||'Unnamed task')}</strong><br>Status: ${item.done?'Done':'To do'} · Helper: ${esc(item.owner||'Unassigned')}<br>Due: ${esc(item.due||'Not set')} · Scope ID: ${esc(item.gatheringId||'Whole occasion')}</p>`:`<p class="preserve"><strong>${esc(item.title||'Unnamed gathering')}</strong><br>${esc(item.date||'Date not set')} · ${esc(item.time||'Start not set')} (venue-local)<br>${esc(item.venue||'Place not set')}</p><h4>Running order removed with this gathering</h4><ol>${item.sequence.map(x=>`<li class="preserve">${esc(x.time||'Time not set')} — ${esc(x.activity||'Activity not set')} · ${esc(x.owner||'Unassigned')}</li>`).join('')}</ol>`;
 return `<section class="card actions" aria-labelledby="removal-heading"><h2 id="removal-heading" tabindex="-1">Review removal — ${r.kind==='task'?'task':'gathering'}</h2>${detail}<p>Before: ${r.before} ${r.kind==='task'?'tasks':'gatherings'}. After: ${r.after}. Only this ${r.kind}${r.kind==='gathering'?' and its running order':''} will be removed from this occasion. Other tasks, gatherings, costs, supplier records and occasions stay unchanged.${r.kind==='gathering'?' The day-of checklist will be reset for review.':''}</p><p>This does not cancel a booking or notify anyone. Earlier shared copies and backup files do not update. Save a new backup if you need one. Suggested items may be proposed again if you later choose that plan.</p><button type="button" data-removal-apply="${token}" class="primary">Remove this exact ${r.kind}</button> <button type="button" data-removal-cancel>Keep my plan unchanged</button></section>`;
}
export function mountRemoval(host,panel,{getOccasion,replaceOccasion,isBusy,message,esc}){
 const session=createRemovalSession({getOccasion,replaceOccasion,isBusy});
 let opener=null;
 const focusPlan=()=>{if(opener?.isConnected){opener.focus();return;}const h=panel.querySelector('h2');if(h){h.tabIndex=-1;h.focus();}};
 const clear=()=>{session.clear();host.innerHTML='';};
 panel.addEventListener('click',e=>{
  const b=e.target.closest('[data-remove-task],[data-remove-gathering]');if(!b)return;
  clear();opener=b;try{const kind=b.hasAttribute('data-remove-task')?'task':'gathering';const review=session.review(kind,b.dataset.removeTask??b.dataset.removeGathering);host.innerHTML=removalPreview(review,esc);host.querySelector('h2').focus();message('Review the exact removal below. Nothing has changed.');}catch(error){message(error.message);}
 });
 host.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-removal-cancel')){clear();message('Removal cancelled. Your plan is unchanged.');focusPlan();}
  if(b.hasAttribute('data-removal-apply')){try{session.apply(Number(b.dataset.removalApply));clear();message('Removed from this session only. Other records are unchanged. Review fresh handovers; earlier copies do not update. Save explicitly if you want to keep this change.');focusPlan();}catch(error){clear();message(error.message);}}
 });
 return {invalidate:clear};
}
