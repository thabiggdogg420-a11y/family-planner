import {createBackupSession} from './backup.js';
export function mountBackup(root,options){
 const controller=createBackupSession(options);let reviewed=null,readEpoch=0;
 root.innerHTML='<h2>Keep a portable private backup</h2><p>New exports use version 12, including private money follow-ups and correction history. Older planner releases (including the private prototype) cannot import version 12; they must reject it rather than discard events. Other gathering is a new pack in the same version-12 format: even older releases that read version 12 reject this unknown pack rather than relabel it. Keep an older backup if you need an older release. Imports from versions 1–10 add unknown quantities only to current gatherings; historical supplier evidence stays unchanged and may require scope re-review. A backup includes <strong>all occasions, private notes, budgets, supplier evidence, responses and private money records/history</strong>. It is not encrypted. Keep it somewhere only you can access. Your browser chooses its save location; a synced Downloads folder may sync it through your own settings. Do not use this file as a guest or helper handover.</p><p>Nothing is uploaded. Import selected occasions or explicitly replace the whole session only after review. Browser-stored drafts stay untouched and Remember turns OFF. Back up this session first if you need to keep it.</p><button id="backup-prepare">Review full backup for download</button><label>Choose a private backup to review (JSON, maximum 1 MB)<input id="backup-file" type="file" accept="application/json,.json"></label><button id="backup-cancel-read" hidden>Cancel file read</button><div id="backup-review"></div><p id="backup-status" role="status" aria-live="polite">No backup read or downloaded.</p>';
 const status=root.querySelector('#backup-status'),panel=root.querySelector('#backup-review');
 function clear(message){readEpoch++;root.querySelector('#backup-cancel-read').hidden=true;controller.clear();reviewed=null;panel.replaceChildren();root.querySelector('#backup-file').value='';if(message)status.textContent=message;}
 function cancelReview(){clear('Cancelled. Current session and stored draft unchanged.');root.querySelector('#backup-prepare').focus();}
 function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
 function summary(o){return `${o.title||'Untitled'} · ${o.type} · ${o.subjects||'No subject entered'} · ${o.gatherings.length} gathering(s), ${o.tasks.length} task(s)`;}
 function showChoices(r){
  reviewed=r;panel.replaceChildren();
  const heading=node('h3','Choose occasions from this backup');heading.tabIndex=-1;
  const intro=node('p',`${r.data.occasions.length} file occasion(s); ${options.getData().occasions.length} current occasion(s). Nothing is selected. Add selected occasions or explicitly replace individual collisions. Matching IDs do NOT prove these are the same real event. Compare subjects and contents before replacing. No field merge, renaming, automatic sync or cloud upload.`);
  const controls=[];panel.append(heading,intro);
  for(const incoming of r.data.occasions){
   const existing=options.getData().occasions.find(o=>o.id===incoming.id),action=existing?'replace':'add';
   const box=node('fieldset'),legend=node('legend',summary(incoming));box.append(legend,node('p',`File identity: ${incoming.id}`));
   if(existing)box.append(node('p','CURRENT OCCASION WITH THIS ID: '+summary(existing)),node('p','Replacing discards the current session version of this one occasion, including its private history and unfinished editor inputs. Back up this session and finish or copy unfinished work first. Matching IDs may be unrelated events.'));
   const label=node('label');label.className='check';const input=node('input');input.type='checkbox';input.dataset.importId=incoming.id;input.dataset.importAction=action;
   label.append(input,document.createTextNode(existing?'Explicitly replace this current occasion with the file version':'Add this file occasion; leave current occasions unchanged'));box.append(label);controls.push(input);panel.append(box);
  }
  const select=node('button','Review selected occasion changes');select.id='backup-select-review';select.disabled=true;
  for(const input of controls)input.onchange=()=>{select.disabled=!controls.some(c=>c.checked)||!controller.current();};
  select.onclick=()=>{try{const actions=controls.filter(c=>c.checked).map(c=>({id:c.dataset.importId,action:c.dataset.importAction}));show(controller.selectReview(actions));}catch(e){status.textContent=e.message;}};
  const whole=node('button','Review replacing ALL current occasions instead');whole.id='backup-whole-review';whole.onclick=()=>show(r);
  const cancel=node('button','Cancel backup review');cancel.id='backup-cancel';cancel.onclick=cancelReview;
  panel.append(select,whole,cancel);status.textContent='Choose locally; no session or stored draft changed.';heading.focus();
 }
 function show(r){
  reviewed=r;if(!r)return;panel.replaceChildren();const importing=r.kind!=='export',selective=r.kind==='selective-import';
  const heading=node('h3',selective?'Review selected occasion changes':importing?'Review replacing ALL current occasions':'Review exact private backup');
  const description=node('p',selective?`${r.selected.changes.filter(c=>c.action==='add').length} addition(s), ${r.selected.changes.filter(c=>c.action==='replace').length} replacement(s). Unselected current occasions and the current active identity stay unchanged. IDs and historical evidence are preserved, not matched or merged. Remember turns OFF; browser-stored draft stays untouched.`:`${importing?'This replaces ALL current occasions with':'This contains'} ${importing?r.data.occasions.length:options.getData().occasions.length} occasion(s). All file contents are shown below. No external actions, bookings or approvals are carried out.`);
  panel.append(heading,description);
  let changes=null;
  if(selective){panel.append(node('h4','Exact selected changes: before and after'));changes=node('pre',JSON.stringify(r.selected.changes,null,2));changes.id='backup-selected-changes';changes.className='preserve';changes.style.maxHeight='22rem';changes.style.overflow='auto';panel.append(changes,node('h4','Complete resulting private session'));
  }
  const pre=node('pre',r.file.text);pre.className='preserve';pre.id='backup-exact';pre.style.maxHeight='22rem';pre.style.overflow='auto';
  const label=node('label');label.className='check';const ack=node('input');ack.type='checkbox';ack.id='backup-ack';
  label.append(ack,document.createTextNode(selective?'I reviewed the exact selected additions and replacements, including displaced history, and accept these session changes.':importing?'I reviewed this file and accept replacing ALL current occasions.':'I reviewed the private contents and want to save this unencrypted file.'));
  const go=node('button',selective?'Apply reviewed selected occasions':importing?'Replace entire session from reviewed backup':'Download reviewed backup');go.id='backup-confirm';go.disabled=true;
  const cancel=node('button','Cancel backup review');cancel.id='backup-cancel';cancel.onclick=cancelReview;
  ack.onchange=()=>go.disabled=!ack.checked||!controller.current();
  go.onclick=()=>{try{
   if(pre.textContent!==reviewed.file.text||(selective&&changes.textContent!==JSON.stringify(reviewed.selected.changes,null,2)))throw Error('File preview changed. Review again.');
   if(importing){controller.apply(ack.checked);clear(selective?'Selected occasions imported into this session. Other occasions and browser-stored draft unchanged. Remember is OFF.':'Backup imported into this session. Remember is OFF; existing browser draft unchanged.');}
   else{const f=controller.download(ack.checked),url=URL.createObjectURL(new Blob([f.text],{type:f.mime}));let a;try{a=document.createElement('a');a.href=url;a.download=f.filename;a.hidden=true;document.body.append(a);a.click();}finally{a?.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}status.textContent='Download requested. Check your browser and save location; a saved file is not verified. Nothing uploaded.';}
  }catch(e){clear(e.message);}};
  panel.append(pre,label,go,cancel);status.textContent='Review ready. Nothing replaced or downloaded.';heading.tabIndex=-1;heading.focus();
 }
 root.querySelector('#backup-prepare').onclick=()=>{try{show(controller.exportReview());}catch(e){clear(e.message);}};
 root.querySelector('#backup-cancel-read').onclick=()=>{clear('File read cancelled. Current session and stored draft unchanged.');root.querySelector('#backup-file').focus();};
 root.querySelector('#backup-file').onchange=async e=>{const ticket=++readEpoch,f=e.target.files?.[0];panel.replaceChildren();reviewed=null;if(!f){clear('No file selected.');return;}status.textContent='Reading selected file locally…';root.querySelector('#backup-cancel-read').hidden=false;try{const r=await controller.importReview(f);if(ticket!==readEpoch)return;root.querySelector('#backup-cancel-read').hidden=true;if(r)showChoices(r);}catch(err){if(ticket===readEpoch)clear('Backup not imported: '+err.message);}};
 return {invalidate(){clear('Plan or view changed. Review the backup again before continuing.');}};
}
