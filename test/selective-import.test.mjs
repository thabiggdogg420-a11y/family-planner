import test from 'node:test';import assert from 'node:assert/strict';
import {occasion} from '../public/celebrations/model.js';
import {reviewSelectiveImport,applySelectiveImport} from '../public/celebrations/selective-import.js';
import {createBackupSession,createBackup,readBackup} from '../public/celebrations/backup.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const workspace=(...ids)=>({occasions:ids.map(id=>occasion(id,'birthday')),active:ids[0]});
const file=data=>{const text=createBackup(data).text;return {size:new TextEncoder().encode(text).length,text:async()=>text};};
function session(data){let current=structuredClone(data),generation=0,busy=false,calls=0;const stored=JSON.stringify(data);const controller=createBackupSession({getData:()=>current,getGeneration:()=>generation,isBusy:()=>busy,replaceSession:next=>{current=structuredClone(next);generation++;calls++;}});return {controller,get data(){return current;},get calls(){return calls;},stored,edit:()=>generation++,busy:v=>busy=v};}
test('selected add and explicit collision replacement preserve all unselected current bytes and source identity',()=>{
 const base=workspace('same','untouched'),source=workspace('same','new','omitted');base.occasions[0].title='CURRENT OLD';base.occasions[1].roles='PRIVATE CURRENT';source.occasions[0].title='FILE NEW';source.occasions[0].tasks[0].done=true;source.occasions[0].costs=[{label:'Private cost',amount:'20'}];
 const before=JSON.stringify(base),sourceBefore=JSON.stringify(source),r=reviewSelectiveImport(base,source,[{id:'same',action:'replace'},{id:'new',action:'add'}]);const out=applySelectiveImport(base,r);
 assert.equal(JSON.stringify(base),before);assert.equal(JSON.stringify(source),sourceBefore);assert.deepEqual(out.occasions[0],source.occasions[0]);assert.deepEqual(out.occasions[1],base.occasions[1]);assert.deepEqual(out.occasions[2],source.occasions[1]);assert.equal(out.active,base.active);assert.equal(out.occasions.length,3);assert.deepEqual(readBackup(createBackup(out).text),out);
});
test('no selection, duplicate/unknown IDs, ambiguous action and tampering fail without mutation',()=>{
 const base=workspace('same'),source=workspace('same','new'),before=JSON.stringify(base);
 for(const actions of [[],[{id:'same',action:'add'}],[{id:'new',action:'replace'}],[{id:'missing',action:'add'}],[{id:'new',action:'add'},{id:'new',action:'add'}],[{id:'new',action:'add',extra:true}]])assert.throws(()=>reviewSelectiveImport(base,source,actions));
 const r=reviewSelectiveImport(base,source,[{id:'new',action:'add'}]);for(const mutate of [r=>r.next.occasions[0].title='tamper',r=>r.changes[0].after.title='tamper',r=>r.actions[0].action='replace']){const changed=structuredClone(r);mutate(changed);assert.throws(()=>applySelectiveImport(base,changed));}
 base.occasions[0].title='Edited';assert.throws(()=>applySelectiveImport(base,r));base.occasions[0].title='New birthday';assert.equal(JSON.stringify(base),before);
});
test('capacity limits and malicious or unsupported files fail closed; replacement at capacity succeeds',()=>{
 const base=workspace(...Array.from({length:12},(_,i)=>'o'+i)),source=workspace('new','o0');assert.throws(()=>reviewSelectiveImport(base,source,[{id:'new',action:'add'}]),/12-occasion/);assert.equal(applySelectiveImport(base,reviewSelectiveImport(base,source,[{id:'o0',action:'replace'}])).occasions.length,12);
 for(const change of [s=>s.occasions.push(structuredClone(s.occasions[0])),s=>s.occasions[0].type='unknown',s=>s.occasions[0].privateExtra='bad']){const bad=structuredClone(source);change(bad);assert.throws(()=>reviewSelectiveImport(base,bad,[{id:'new',action:'add'}]));}
 assert.throws(()=>readBackup('{"__proto__":{}}'),/unsafe/);
 const huge=workspace('huge');for(let i=0;i<50;i++)huge.occasions[0].tasks.push({id:'x'+i,text:'x',done:false,owner:'',due:'',gatheringId:''});assert.throws(()=>reviewSelectiveImport(workspace('a'),huge,[{id:'huge',action:'add'}]));
});
test('controller approval, cancel, stale edit, busy, repeated apply and fresh reload boundaries',async()=>{
 const original=workspace('a','keep'),incoming=workspace('a','b');const s=session(original),c=s.controller;await c.importReview(file(incoming));c.selectReview([{id:'b',action:'add'}]);assert.throws(()=>c.apply(false));assert.equal(s.calls,0);c.clear();assert.throws(()=>c.apply(true));assert.deepEqual(s.data,original);
 await c.importReview(file(incoming));c.selectReview([{id:'b',action:'add'}]);s.edit();assert.throws(()=>c.apply(true));assert.deepEqual(s.data,original);
 await c.importReview(file(incoming));c.selectReview([{id:'b',action:'add'}]);s.busy(true);assert.throws(()=>c.apply(true));s.busy(false);c.apply(true);assert.equal(s.calls,1);assert.throws(()=>c.apply(true));assert.equal(s.data.occasions.length,3);assert.equal(s.stored,JSON.stringify(original));
 const fresh=session(JSON.parse(s.stored));assert.deepEqual(fresh.data,original);assert.throws(()=>fresh.controller.apply(true));
});
test('late file reads and selection mutation cannot override newer work or accepted review',async()=>{
 const s=session(workspace('a'));let resolve;const deferred={size:100,text:()=>new Promise(r=>resolve=r)};const pending=s.controller.importReview(deferred);s.controller.clear();resolve(createBackup(workspace('b')).text);assert.equal(await pending,null);assert.equal(s.calls,0);
 const actions=[{id:'b',action:'add'}];await s.controller.importReview(file(workspace('b')));const exposed=s.controller.selectReview(actions);actions[0].id='evil';exposed.selected.next.occasions[0].title='tamper';s.controller.apply(true);assert.equal(s.data.occasions[0].title,'New birthday');assert.equal(s.data.occasions[1].id,'b');
});
test('unchanged whole-session import remains explicit and usable',async()=>{const s=session(workspace('old'));await s.controller.importReview(file(workspace('new')));s.controller.apply(true);assert.equal(s.data.active,'new');assert.equal(s.data.occasions.length,1);assert.equal(s.stored,JSON.stringify(workspace('old')));});
test('actual UI source keeps choices unchecked, text-only labels, exact change preview and explicit whole replacement',()=>{const ui=readFileSync(new URL('../public/celebrations/backup-view.js',import.meta.url),'utf8');assert.match(ui,/input.type='checkbox'/);assert.doesNotMatch(ui,/checked\s*=\s*true/);assert.match(ui,/Matching IDs do NOT prove/);assert.match(ui,/CURRENT OCCASION WITH THIS ID/);assert.match(ui,/backup-selected-changes/);assert.match(ui,/Review replacing ALL current occasions instead/);assert.match(ui,/e.textContent=text/);assert.match(ui,/if\(r\)showChoices\(r\)/);});
