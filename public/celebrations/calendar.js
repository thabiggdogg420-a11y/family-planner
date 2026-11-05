// Explicit local calendar handoff. No accounts, sending, alarms or automatic imports.
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const validTime=v=>typeof v==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
export function calendarChoices(o){return [...o.gatherings.map(g=>({key:'g:'+g.id,kind:'Gathering start',title:g.title||'Unnamed gathering',date:g.date,time:g.time,venue:g.venue||'',valid:validDate(g.date)&&validTime(g.time)})),...o.tasks.filter(t=>!t.done).map(t=>({key:'t:'+t.id,kind:'Task due',title:t.text||'Unnamed task',date:t.due,time:null,venue:'',valid:validDate(t.due)}))];}
export function reviewCalendar(o,keys,includeVenue=false,stamp=new Date().toISOString(),uid=globalThis.crypto.randomUUID()){
 if(!Array.isArray(keys)||!keys.length||new Set(keys).size!==keys.length)throw Error('Choose at least one distinct calendar item.');
 if(typeof includeVenue!=='boolean'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||!/^[a-zA-Z0-9-]{1,80}$/.test(uid))throw Error('Invalid calendar review.');
 const choices=calendarChoices(o),items=keys.map(key=>{const item=choices.find(x=>x.key===key);if(!item||!item.valid)throw Error('Selected item needs a valid date and, for a gathering, start time. Correct it in the plan first.');return {key:item.key,kind:item.kind,title:item.title,date:item.date,time:item.time,venue:includeVenue?item.venue:''};});
 return {source:JSON.stringify(o),keys:[...keys],includeVenue,stamp,uid,items};
}
const escapeText=s=>String(s).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');
function fold(line){let out='',part='',bytes=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>75){out+=part+'\r\n';part=' ';bytes=1;}part+=ch;bytes+=n;}return out+part;}
export function calendarFile(o,review){
 if(!review||review.source!==JSON.stringify(o))throw Error('Plan changed. Prepare and review a fresh calendar copy.');
 const fresh=reviewCalendar(o,review.keys,review.includeVenue,review.stamp,review.uid);
 if(JSON.stringify(fresh)!==JSON.stringify(review))throw Error('Calendar preview changed. Prepare it again.');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Plan4Free//Selected calendar draft//EN','CALSCALE:GREGORIAN'];
 fresh.items.forEach((x,i)=>{lines.push('BEGIN:VEVENT',`UID:${fresh.uid}-${i}@plan4free.local`,`DTSTAMP:${fresh.stamp.replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,x.time?`DTSTART:${x.date.replace(/-/g,'')}T${x.time.replace(':','')}00`:`DTSTART;VALUE=DATE:${x.date.replace(/-/g,'')}`,`SUMMARY:${escapeText(x.kind==='Task due'?'Due: '+x.title:x.title)}`,'STATUS:TENTATIVE','TRANSP:TRANSPARENT',`DESCRIPTION:${escapeText('Plan4Free planning copy. Not a booking or accepted assignment. '+(x.time?'Floating local time: use the venue timezone in your calendar. No end time or duration supplied.':'All-day task due marker, not a scheduled work period.')+' No automatic updates. Check and remove old imports before importing a replacement.')}`);if(x.venue)lines.push('LOCATION:'+escapeText(x.venue));lines.push('END:VEVENT');});
 lines.push('END:VCALENDAR');return {filename:'plan4free-calendar-draft.ics',mime:'text/calendar;charset=utf-8',text:lines.map(fold).join('\r\n')+'\r\n'};
}
