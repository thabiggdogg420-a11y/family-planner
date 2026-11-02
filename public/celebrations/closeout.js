// Derived view of existing task progress, not a new lifecycle or external receipt.
export function closeoutTask(o,occasionId,taskId){
 if(o.id!==occasionId||o.journey.stage!=='wrap-up')throw Error('This wrap-up changed. Open the current occasion and choose Wrap-up again.');
 const index=o.tasks.findIndex(t=>t.id===taskId);
 if(index<0)throw Error('This task changed or was removed. Review the current wrap-up.');
 return {task:o.tasks[index],index,path:`tasks.${index}.text`};
}
export function setCloseoutDone(o,occasionId,taskId,expected,done){
 const {task}=closeoutTask(o,occasionId,taskId);
 if(typeof expected!=='boolean'||typeof done!=='boolean'||task.done!==expected||expected===done)throw Error('Task progress changed. Review it again before updating.');
 task.done=done;
}
export function renderCloseout(o,esc){
 const row=t=>`<li><p class="preserve"><strong>${esc(t.text||'Unnamed task')}</strong><br>Owner alias: ${esc(t.owner||'Not set')} · Due: ${esc(t.due||'Not set')} · Scope: ${esc(t.gatheringId?o.gatherings.find(g=>g.id===t.gatheringId)?.title||'Unknown gathering':'Whole occasion')}</p><button type="button" data-closeout-edit="${esc(t.id)}" data-closeout-occasion="${esc(o.id)}">Review this task / next step</button> <button type="button" data-closeout-done="${esc(t.id)}" data-closeout-occasion="${esc(o.id)}" data-closeout-expected="${t.done}">${t.done?'Undo organiser completion':'Mark done — organiser record'}</button></li>`;
 const remaining=o.tasks.filter(t=>!t.done),done=o.tasks.filter(t=>t.done);
 return `<section class="card actions" data-private-closeout aria-labelledby="closeout-heading"><h3 id="closeout-heading" tabindex="-1">Practical tasks to revisit</h3><p>These are your existing unfinished tasks, not newly required or overdue obligations. Decide what still applies. Review a task to amend its next step, optional owner alias or due date. An alias is not an accepted assignment.</p>${remaining.length?`<ul>${remaining.map(row).join('')}</ul>`:'<p>No existing tasks remain unchecked. This does not confirm that costs are settled, items returned or the occasion is complete.</p>'}<details><summary>Review organiser-marked-done tasks / undo</summary>${done.length?`<ul>${done.map(row).join('')}</ul>`:'<p>No tasks marked done.</p>'}</details><p class="small">Done is only your local progress record. Nothing is paid, returned, delivered or sent by this app. The optional reminders above are separate: checking them does not complete these tasks. Earlier shared copies do not update.</p></section>`;
}
