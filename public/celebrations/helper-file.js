// Explicitly reviewed offline handover, never a delivery or accepted assignment.
import {helperReviewCurrent} from './helper.js';
export function createHelperFile(o,review){
 if(!helperReviewCurrent(o,review))throw Error('Plan or selected handover changed. Review it again.');
 const c=review.copy,lines=['HELPER RUNBOOK — DRAFT FOR MANUAL SHARING',c.heading,'Not sent. Aliases are not acceptance; confirm responsibilities privately.','Times are venue-local; timezone not established. Blank facts remain unknown.',''];
 if(c.gatherings?.length){lines.push('SELECTED ARRIVAL DETAILS');for(const g of c.gatherings)lines.push(g.name||'Gathering name not set',`Date: ${g.date||'Not set'} | Start: ${g.time||'Not set'}`,`Place: ${g.venue||'Not set'}`,'');}
 if(c.tasks.length){lines.push('SELECTED TASKS');for(const t of c.tasks)lines.push(`${t.done?'Recorded done':'To do'}: ${t.text||'Task not set'}`,`Owner alias: ${t.owner||'Unassigned'} | Due: ${t.due||'Not set'} | Scope: ${t.scope||'Not set'}`,'');}
 if(c.sequence.length){lines.push('SELECTED RUNNING ORDER — IN PLANNED ORDER');for(const r of c.sequence)lines.push(`${r.gathering||'Gathering not set'} | ${r.date||'Date not set'} | ${r.time||'Time not set'}`,`${r.activity||'Activity not set'} | Helper alias: ${r.owner||'Unassigned'}`,'');}
 if(Object.hasOwn(c,'practical'))lines.push('OPTED-IN PRACTICAL / BACKUP NOTES',c.practical||'No notes entered','');
 lines.push('CHECK BEFORE USE','This is a static copy, not a live plan. Later changes do not update downloaded or shared copies.','Check arrival details, responsibilities and any backup arrangements privately. Missing details are not confirmed.','No booking, notification, RSVP, calendar invitation or emergency service is provided. This file is not a restorable backup.','');
 return {filename:'helper-runbook-draft.txt',mime:'text/plain;charset=utf-8',text:lines.join('\n')};
}
