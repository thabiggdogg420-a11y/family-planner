// Derived planning prompts, never a readiness verdict or a verified scheduling conflict.
// No sorting, inferred durations, timezone conversion, or changes to the source plan.
const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function timingChecks(o) {
 const findings=[], aliases=new Map();
 const add=(kind,text,targets)=>findings.push({kind,text,targets});
 o.gatherings.forEach((g,i)=>{
  const name=g.title.trim()||`Gathering ${i+1}`, base=`gatherings.${i}`;
  const target=(path,label)=>({path:base+path,label:`${name}: ${label}`});
  if(!validDate(g.date)) add('unknown-date',`${name}: date is missing or invalid. Same-date checks with other gatherings cannot include this gathering.`,[target('.date','date')]);
  if(!validTime(g.time)) add('unknown-start',`${name}: start time is missing or invalid. Earlier-than-start checks cannot run.`,[target('.time','start time')]);
  let previous=null;
  const slots=new Map();
  g.sequence.forEach((r,j)=>{
   const ref=target(`.sequence.${j}.time`,`cue ${j+1} time`);
   if(!validTime(r.time)){add('unknown-cue',`${name}, cue ${j+1}: time is missing or invalid. It stays in its planned position; no time is guessed.`,[ref]);return;}
   if(validTime(g.time)&&r.time<g.time)add('before-start',`${name}, cue ${j+1} (${r.time}) is earlier than the gathering start (${g.time}). This may be intentional setup; check the date and time.`,[ref,target('.time','start time')]);
   if(previous&&r.time<previous.time)add('backwards',`${name}: cue ${j+1} (${r.time}) is earlier than preceding timed cue ${previous.index+1} (${previous.time}). Planned order is unchanged. For a different day, use a separate gathering.`,[ref,target(`.sequence.${previous.index}.time`,`cue ${previous.index+1} time`)]);
   previous={time:r.time,index:j};
   if(!slots.has(r.time))slots.set(r.time,[]);
   slots.get(r.time).push(ref);
   // Exact trimmed aliases only: aliases do not establish identity or availability.
   if(validDate(g.date)&&r.owner.trim()){
    const key=JSON.stringify([g.date,r.time,r.owner.trim()]);
    if(!aliases.has(key))aliases.set(key,[]);
    aliases.get(key).push({gathering:i,ref,owner:r.owner.trim(),date:g.date,time:r.time});
   }
  });
  for(const [time,targets] of slots)if(targets.length>1)add('same-time',`${name}: ${targets.length} cues use ${time}. Parallel activities may be intentional; check who is doing what.`,targets);
 });
 for(const entries of aliases.values())if(new Set(entries.map(x=>x.gathering)).size>1){const x=entries[0];add('alias-same-time',`Alias “${x.owner}” appears in different gatherings at ${x.time} on ${x.date}. Check privately whether this is the same person and the same timezone; this is not a confirmed clash.`,entries.map(x=>x.ref));}
 return findings;
}
export function renderTiming(o,esc){
 const findings=timingChecks(o);
 return `<section class="card" aria-labelledby="timing-heading"><p class="eyebrow">AUTOMATIC LOCAL CHECK · NOT LIVE COORDINATION</p><h3 id="timing-heading" tabindex="-1">Check the day’s timings</h3><p>These prompts use your entered dates and venue-local clock times. They do not block the plan or mark anything ready. Setup and parallel activities may be intentional.</p>${findings.length?`<p><strong>${findings.length} timing prompt(s) to review.</strong> Nothing has been changed.</p><ul>${findings.map(f=>`<li class="preserve">${esc(f.text)}<div class="actions">${f.targets.map(t=>`<button type="button" data-timing-path="${esc(t.path)}">Check ${esc(t.label)}</button>`).join(' ')}</div></li>`).join('')}</ul>`:'<p>No timing prompts found in the entered facts. This is not confirmation that the schedule works.</p>'}<p class="small">Durations, travel, timezones, availability and acceptance are unknown here; overlaps between different start times cannot be checked. Blank helper aliases are not assignments. Edit only what needs changing, then return to recheck. Later edits do not update previously downloaded or shared runbooks.</p><button type="button" data-journey-view="helper">Prepare a fresh selected helper runbook</button></section>`;
}
