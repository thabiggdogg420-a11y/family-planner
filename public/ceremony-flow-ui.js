import {CEREMONY_OUTPUTS,CEREMONY_CHECKS,createCeremonyFlow,preparationReview} from './ceremony-flow-model.js';
const bridge=window.familyFramesPlanning,ui=window.familyFramesUI,ledger=createCeremonyFlow(),listeners=[];
const rehearseRoot=document.getElementById('rehearseNavigator');
let route=ui.getRoute(),createView=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const link=(text,destination,cls='text-link')=>{const a=el('a',text,cls);a.href='#'+destination;return a;};
const button=(text,fn)=>{const b=el('button',text,'quiet');b.type='button';b.addEventListener('click',fn);return b;};
function notify(){for(const fn of listeners)fn();}
function receiptText(receipt){return receipt.label+': download requested'+(receipt.current?' from the current workspace.':' from an older workspace — regenerate after changes.');}
function receiptRows(parent){const state=ledger.view(bridge.getWorkspace());if(!state.receipts.length)parent.append(el('p','No document download is recorded in this session yet. Montage downloads are reviewed separately in the local studio.'));for(const receipt of state.receipts)parent.append(el('p',receiptText(receipt),receipt.current?'small':'notice'));return state;}
function outputTile(kind,selected){
 const meta=CEREMONY_OUTPUTS[kind],a=link('',meta.route,'action-card'),copy=el('span',null,'card-copy');
 const receipt=ledger.view(bridge.getWorkspace()).receipts.find(r=>r.kind===kind);
 let detail=kind==='helper'?'Select only responsibilities for the intended helper. No one is contacted.':meta.group==='private'?'Private organiser use. Select, preview and approve this copy separately.':'Preview, review and download — not sent or published.';
 if(receipt)detail=receipt.current?'Download requested this session. Check and open the file in Downloads.':'Earlier copy is stale after edits. Make and review a fresh copy.';
 copy.append(el('strong',meta.label),el('span',detail));if(selected)copy.append(el('span','Chosen in your guided plan','small'));a.append(copy,el('span','→','category-arrow'));a.dataset.ceremonyOutput=kind;
 if(kind==='program'||kind==='card')a.addEventListener('click',()=>{const field=document.getElementById('kind');field.value=kind;field.onchange();});return a;
}
function tributePanel(parent){
 const panel=el('section',null,'panel compact');panel.append(el('h3','Local silent photo montage'),el('p','Arrange local images, exact captions and hold times, then review and record a real silent WebM in supported browsers. This temporary media draft is separate from planner saving and backups. No music or existing-video import.','small'),link('Open the local silent montage studio →','montage'));parent.append(panel);
}
function refreshCreate(){
 if(!createView||route!=='guided/ready'||!createView.root.contains(createView.container))return;
 const {container,selectedOutputs,applied}=createView;container.replaceChildren();
 container.append(el('p',applied?'Your reviewed changes are in the workspace. Chosen outputs are marked below; every other tool is still available.':'Use the current recorded plan. Each output has its own complete preview and approval. No need to finish every planning area.'));
 for(const [group,label,detail] of [['guest','Guest copies','Review only what guests should see. Programme, card and invitation remain separate outputs. Silent montage frames and video have their own separate review in the studio.'],['private','Private working copies','Keep organiser records private. A helper brief is limited sharing: choose only the tasks that helper should see.']]){
  const section=el('section',null,'panel');section.append(el('h2',label),el('p',detail,'small'));const grid=el('div',null,'creation-grid');
  for(const kind of Object.keys(CEREMONY_OUTPUTS).filter(k=>CEREMONY_OUTPUTS[k].group===group&&k!=='sequence'))grid.append(outputTile(kind,selectedOutputs.includes(kind)));section.append(grid);if(group==='guest')tributePanel(section);container.append(section);
 }
 container.append(link('Build / operate your private ceremony sequence →','sequence'),link('Make a selected afterward handover or process-enquiry draft →','afterward'));
 const receipts=el('section',null,'panel');receipts.append(el('h2','What has actually happened?'),el('p','Temporary notes for this page session only. A download request is not proof that a file was saved, received or used. Nothing is sent, booked, paid, lodged or published.','small'));receiptRows(receipts);container.append(receipts,link('Rehearse your saved copies →','rehearse','button'),link('Review / edit the current plan →','outcomes'),link('Change wishes or guided answers →','guided'));
}
function renderCreate(root,{selectedOutputs=[],applied=false}={}){
 const container=createView?.root===root&&root.contains(createView.container)?createView.container:el('div');container.dataset.ceremonyCreate='true';if(!root.contains(container))root.append(container);createView={root,container,selectedOutputs:Array.isArray(selectedOutputs)?selectedOutputs.filter(k=>Object.hasOwn(CEREMONY_OUTPUTS,k)):[],applied:applied===true};refreshCreate();
}
function preparationBoard(state){
 const review=preparationReview(bridge.getWorkspace(),state),board=el('section',null,'panel');board.dataset.preparationBoard='true';
 board.append(el('p','YOUR PLAN → YOUR COPIES → YOUR FALLBACK','eyebrow'),el('h2','A practical handover, not a readiness score'),el('p','Use what fits your farewell. These are prompts from your current private plan—not required funeral steps, confirmed arrangements or proof that the day is ready.','small'));
 const next=el('div',null,'notice');next.append(el('h3',review.next.title),el('p',review.next.detail));if(review.next.route)next.append(link('Take this next step →',review.next.route));board.append(next);
 const plan=el('section',null,'preparation-step');plan.append(el('h3','1. Confirm the plan with the people involved'));
 plan.append(el('p',review.missing.length?'Still unrecorded: '+review.missing.join(', ')+'. Leave anything undecided blank; add it only if relevant.':'Date, start time, time zone, place and day-of lead are recorded. Confirm them with the people involved; the app has not verified them.'));
 plan.append(link('Review event details and day-of lead →','outcomes/event'));
 plan.append(el('p',review.openCount?review.openCount+' unfinished task'+(review.openCount===1?'':'s')+' recorded'+(review.unownedCount?' · '+review.unownedCount+' without an owner.':'. Owners are recorded, but acceptance is not verified.'):'No unfinished named tasks recorded. This does not mean every real-world responsibility is covered.'));
 plan.append(link('Review responsibilities →','tasks'),link('Prepare a selected helper brief →','outcomes/helper'));
 if(review.pending)plan.append(el('p',review.pending+' proposed task change'+(review.pending===1?' still needs':'s still need')+' review. Proposals are not agreed responsibilities.'),link('Review proposed changes →','plan/review'));
 const copies=el('section',null,'preparation-step');copies.append(el('h3','2. Match the copies to this version of the plan'));
 copies.append(el('p',review.stale.length?'Refresh before use: '+review.stale.map(r=>r.label).join(', ')+'. Earlier downloaded files are not updated automatically.':review.current.length?review.current.length+' current-workspace download request'+(review.current.length===1?' is':'s are')+' recorded. Open the actual files; a request does not prove they were saved.':'No ceremony-document download requests recorded in this session. Afterward handovers and montage files are separate. You can make one ceremony copy without completing the whole plan.'));
 if(!review.hasName||!review.hasService)copies.append(el('p','Guest programme review: '+[!review.hasName?'name or heading not recorded':'',!review.hasService?'service order not recorded':''].filter(Boolean).join('; ')+'. Keep placeholders only if you intend to use them.'),link('Review memorial words →','words'),link('Shape the order of service →','service'));
 copies.append(link('Review the private operator sequence and handoffs →','sequence'),link('Create or review a local silent montage →','montage'));
 copies.append(link('Choose or refresh copies →','guided/ready'),link('Review the private day-of sheet →','outcomes/runsheet'));
 copies.append(el('p','Guest programme, card and invitation are separate from private organiser records. Review every selected helper task before sharing a brief. Nothing is sent automatically.','small'));
 const recovery=el('section',null,'preparation-step');recovery.append(el('h3','3. Keep a paper fallback and a recovery copy'),el('p','Agree who will bring the files and printed programme, and who can continue if equipment fails. Rehearse the actual saved video on the intended device, whether made in this local studio or elsewhere. Studio playback does not verify the venue or offline copy.'),el('p','A guest keepsake cannot restore your plan. For continuity, download a separate private backup and keep it secure. Saving OFF means page edits can disappear when you close or reload.'),link('Review saving and privacy →','settings'),link('Download or review a private backup →','backup'),el('p','Backups are unencrypted and contain private planning. Restore only after reviewing the replacement. A restore does not enable local saving; rehearsal checks are temporary and are not backed up.','small'));
 board.append(plan,copies,recovery);return board;
}
function renderRehearse(){
 if(route!=='rehearse'||!rehearseRoot)return;rehearseRoot.replaceChildren();const title=el('div',null,'page-heading'),h1=el('h1','Check the copies you will actually use.');h1.tabIndex=-1;h1.setAttribute('data-route-heading','');title.append(el('p','REHEARSE · YOUR SAVED FILES','eyebrow'),h1,el('p','Keep a printed programme as the fallback. These checks are yours; the app cannot verify your Downloads folder, printer, playback device or venue.'));rehearseRoot.append(link('← Back to Create','guided/ready','back-link'),title);
 const requests=el('section',null,'panel');requests.append(el('h2','Download requests this session'),el('p','These notes do not store your files. Open downloaded copies separately. This list tracks ceremony documents, quote-question drafts and selected afterward handover/enquiry/check-date requests, not montage files. Quote-question and afterward requests do not count as ceremony copies or rehearsal checks. A check-date file request is not a calendar import or scheduled reminder. A quote-question request does not identify a supplier or prove that any question was sent. The separate local studio can create and play a silent WebM, but cannot verify your saved file or venue.','small'));const state=receiptRows(requests);rehearseRoot.append(preparationBoard(state),requests);
 const checks=el('section',null,'panel');checks.append(el('h2','Your own rehearsal checks'),el('p','Mark only checks you have actually carried out. These temporary, self-reported checks are not technical verification. They reset whenever the workspace changes and are not saved or included in backups. Skip anything that is not relevant.','small'));
 for(const [id,text] of Object.entries(CEREMONY_CHECKS)){const label=el('label',null,'check'),input=el('input');input.type='checkbox';input.checked=state.checks[id];input.dataset.ceremonyCheck=id;input.addEventListener('change',()=>{ledger.setCheck(id,input.checked,bridge.getWorkspace());notify();});label.append(input,el('span',text));checks.append(label);}rehearseRoot.append(checks,link('Open the private afterward handover →','afterward'),link('Create or refresh a copy →','guided/ready','button'),link('Review the private day-of sheet →','outcomes/runsheet'));
}
window.familyFramesCeremony={view:()=>ledger.view(bridge.getWorkspace()),renderCreate,recordOutput(kind){if(ledger.recordOutput(kind,bridge.getWorkspace())){refreshCreate();renderRehearse();notify();}},subscribe(fn){if(typeof fn==='function')listeners.push(fn);}};
bridge.subscribe(()=>{ledger.invalidateChecks();refreshCreate();renderRehearse();notify();});
ui.subscribe(next=>{route=next;renderRehearse();});
renderRehearse();
