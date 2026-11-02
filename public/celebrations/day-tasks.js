// Existing organiser progress only. No new records, assignments, sends or readiness verdict.
export function dayTask(o,occasionId,taskId){
 if(o.id!==occasionId||o.journey.stage!=='day-of')throw Error('This day-of plan changed. Open the current occasion and choose On the day again.');
 const index=o.tasks.findIndex(t=>t.id===taskId);
 if(index<0)throw Error('This task changed or was removed. Review the current day-of plan.');
 return {task:o.tasks[index],index,path:`tasks.${index}.text`};
}
export function setDayTaskDone(o,occasionId,taskId,expected,done){
 const {task}=dayTask(o,occasionId,taskId);
 if(typeof expected!=='boolean'||typeof done!=='boolean'||task.done!==expected||expected===done)throw Error('Task progress changed. Review it again before updating.');
 task.done=done;
}
export function renderDayTasks(o,esc){
 const row=t=>`<li><p class="preserve"><strong>${esc(t.text||'Unnamed task')}</strong><br>Owner alias: ${esc(t.owner||'Not set')} · Due: ${esc(t.due||'Not set')} · Scope: ${esc(t.gatheringId?o.gatherings.find(g=>g.id===t.gatheringId)?.title||'Unknown gathering':'Whole occasion')}</p><button type="button" data-day-task-edit="${esc(t.id)}" data-day-task-occasion="${esc(o.id)}">Review this task / next step</button> <button type="button" data-day-task-done="${esc(t.id)}" data-day-task-occasion="${esc(o.id)}" data-day-task-expected="${t.done}">${t.done?'Undo organiser completion':'Mark done — organiser record'}</button></li>`;
 const remaining=o.tasks.filter(t=>!t.done),done=o.tasks.filter(t=>t.done);
 return `<section class="card actions" data-private-day-tasks aria-labelledby="day-tasks-heading"><h3 id="day-tasks-heading" tabindex="-1">Your practical tasks on the day</h3><p>These are your existing tasks, not new requirements or a list of what must happen today. Check what still applies, then record your own progress. Dates do not schedule reminders; aliases do not confirm acceptance.</p>${remaining.length?`<ul>${remaining.map(row).join('')}</ul>`:'<p>No existing tasks remain unchecked. This does not confirm that the occasion is ready or any arrangements were carried out.</p>'}<details><summary>Review organiser-marked-done tasks / undo</summary>${done.length?`<ul>${done.map(row).join('')}</ul>`:'<p>No tasks marked done.</p>'}</details><p class="small">The occasion cues and running order are separate. Marking a task does not tick those cues, verify helper acceptance or send an update. Earlier shared copies do not update. Changes may be unsaved; use the existing saving or backup controls if you want to keep them.</p></section>`;
}
