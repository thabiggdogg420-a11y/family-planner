// Temporary ceremony progress only. This module stores no files and never persists data.
export const CEREMONY_OUTPUTS=Object.freeze({
 program:Object.freeze({label:'Guest programme',route:'keepsake',group:'guest'}),
 card:Object.freeze({label:'Guest card',route:'keepsake',group:'guest'}),
 invitation:Object.freeze({label:'Guest invitation',route:'outcomes/invitation',group:'guest'}),
 helper:Object.freeze({label:'Helper task brief',route:'outcomes/helper',group:'private'}),
 organiser:Object.freeze({label:'Private organiser pack',route:'outcomes/pack',group:'private'}),
 runsheet:Object.freeze({label:'Private day-of sheet',route:'outcomes/runsheet',group:'private'})
});
// Non-ceremony documents share the temporary request ledger, not ceremony readiness.
export const ADDITIONAL_DOCUMENT_OUTPUTS=Object.freeze({
 'quote-enquiry':Object.freeze({label:'A quote-question draft from this workspace',route:'outcomes/quote-questions'}),
 'afterward-handover':Object.freeze({label:'Selected private afterward handover',route:'afterward'}),
 'afterward-enquiry':Object.freeze({label:'Private process / message draft',route:'afterward'}),
 'afterward-calendar':Object.freeze({label:'Private chosen check-date file (not scheduled)',route:'afterward'})
});
const TRACKED_DOCUMENT_OUTPUTS=Object.freeze({...CEREMONY_OUTPUTS,...ADDITIONAL_DOCUMENT_OUTPUTS});
export const CEREMONY_CHECKS=Object.freeze({
 files:'I opened the saved files and checked their contents.',
 programme:'I checked the printed programme or print preview, including every page break.',
 offline:'If using a video made in this local studio or elsewhere, I rehearsed the saved file offline on the actual playback device, including full playback, seeking and replay. Studio playback alone does not verify this.',
 support:'I agreed with a support person who will operate the files and use the printed programme if playback fails.'
});
const snapshot=w=>JSON.stringify(w);
export function createCeremonyFlow(){
 const receipts=new Map(),checks=new Map();
 return Object.freeze({
  recordOutput(kind,workspace){if(!Object.hasOwn(TRACKED_DOCUMENT_OUTPUTS,kind))return false;receipts.set(kind,snapshot(workspace));return true;},
  setCheck(id,checked,workspace){if(!Object.hasOwn(CEREMONY_CHECKS,id)||typeof checked!=='boolean')throw Error('Unsupported rehearsal check.');if(checked)checks.set(id,snapshot(workspace));else checks.delete(id);},
  invalidateChecks(){checks.clear();},
  view(workspace){const current=snapshot(workspace);return Object.freeze({receipts:Object.freeze([...receipts].map(([kind,bound])=>Object.freeze({kind,label:TRACKED_DOCUMENT_OUTPUTS[kind].label,current:bound===current,status:'download-requested'}))),checks:Object.freeze(Object.fromEntries(Object.keys(CEREMONY_CHECKS).map(id=>[id,checks.get(id)===current])))});}
 });
}

// Derived guidance, never a certification, new workspace store or saving preference.
export function preparationReview(workspace, flow) {
 const event=workspace.planning?.schemaVersion>=2?workspace.planning.event||{}:{};
 const has=value=>typeof value==='string'&&value.trim().length>0;
 const fields=[['date','Date'],['time','Start time'],['timezone','Time zone'],['venue','Place'],['lead','Day-of lead']];
 const missing=fields.filter(([key])=>!has(event[key])).map(([,label])=>label);
 const tasks=(workspace.privatePlan?.tasks||[]).filter(t=>has(t.task));
 const open=tasks.filter(t=>t.status!=='Done'),unowned=open.filter(t=>!has(t.owner));
 const ceremonyReceipts=flow.receipts.filter(r=>Object.hasOwn(CEREMONY_OUTPUTS,r.kind));
 const stale=ceremonyReceipts.filter(r=>!r.current),current=ceremonyReceipts.filter(r=>r.current);
 const pending=(workspace.planning?.proposals||[]).filter(p=>p.status==='pending').length;
 const next=stale.length?{title:'Refresh the copies changed by your edits',detail:'An older download may no longer match your plan. Review and download a new copy before using it.',route:'guided/ready'}:
 unowned.length?{title:'Give the next practical task a clear owner',detail:'A recorded name is a note, not someone’s agreement. Ask them separately, then prepare a brief containing only their tasks.',route:'tasks'}:
 !ceremonyReceipts.length?{title:'Make one useful copy when you are ready',detail:'Start with a guest programme or a private day-of sheet. Each copy has its own preview and approval.',route:'guided/ready'}:
 {title:'Open the actual files, then practise your fallback',detail:'The app records download requests only. Check your saved files and paper copy on the equipment you will use.',route:null};
 return {missing,openCount:open.length,unownedCount:unowned.length,pending,stale,current,next,
  hasName:has(workspace.memorial?.name),hasService:has(workspace.memorial?.service),hasLead:has(event.lead)};
}
