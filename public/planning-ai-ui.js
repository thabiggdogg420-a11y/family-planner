import {AI_DRAFT_LIMIT,prepareAiReview,discardAiReview,applyReviewedTask} from './planning-ai.js';
const aiBridge=window.familyFramesPlanning,aiGet=id=>document.getElementById(id);
if(!aiBridge)throw Error('Shared workspace unavailable. No AI suggestion was imported.');
let aiReview=null,aiGeneration=0;
const aiStatus=text=>{aiGet('aiSuggestionStatus').textContent=text;if(aiGet('aiSuggestionDialog').open)aiGet('aiSuggestionDialogStatus').textContent=text;};
function aiClearReview(){if(aiReview)discardAiReview(aiReview);aiReview=null;aiGet('aiSuggestionPreview').textContent='';aiGet('aiSuggestionDialogStatus').textContent='';aiGet('aiSuggestionConsent').checked=false;aiGet('approveAiSuggestion').disabled=true;}
function aiCancel(){aiGeneration++;aiClearReview();aiGet('aiSuggestionDialog').close();aiStatus('Review cancelled. Current work and saved data are unchanged. Your pasted draft remains available.');}
async function aiPreview(raw,generation){
 try{
  const review=await prepareAiReview(raw,aiBridge.getWorkspace());
  if(generation!==aiGeneration){discardAiReview(review);return;}
  aiClearReview();aiReview=review;aiGet('aiSuggestionPreview').textContent=review.preview;
  aiGet('aiSuggestionConsentLabel').hidden=!review.canApply;aiGet('approveAiSuggestion').hidden=!review.canApply;
  aiGet('aiSuggestionDialog').showModal();aiStatus(review.canApply?'Review the exact task below. Nothing has changed; approval is optional.':'Review-only draft. No automatic application is available for this type.');
 }catch(error){if(generation===aiGeneration)aiStatus(error.message||'Suggestion could not be reviewed. Current work is unchanged.');}
}
aiGet('reviewAiSuggestion').onclick=()=>{const generation=++aiGeneration;aiClearReview();return aiPreview(aiGet('aiSuggestionText').value,generation);};
aiGet('aiSuggestionFile').onchange=async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 const generation=++aiGeneration;aiClearReview();
 try{if(file.size>AI_DRAFT_LIMIT)throw Error('Choose an AI suggestion under 48 KiB. Current work is unchanged.');const raw=await file.text();if(generation!==aiGeneration)return;await aiPreview(raw,generation);}catch{if(generation===aiGeneration)aiStatus('AI suggestion file could not be read or is too large. Current work and pasted draft are unchanged.');}
};
aiGet('aiSuggestionConsent').onchange=()=>{aiGet('approveAiSuggestion').disabled=!aiReview?.canApply||!aiGet('aiSuggestionConsent').checked;};
aiGet('approveAiSuggestion').onclick=()=>{
 if(!aiReview?.canApply||!aiGet('aiSuggestionConsent').checked)return;
 try{const next=applyReviewedTask(aiReview,aiBridge.getWorkspace());aiGeneration++;aiClearReview();aiGet('aiSuggestionDialog').close();aiBridge.replace(next);aiStatus('Approved task added to your private plan and audit. Nothing was sent, booked, published or paid. Saving follows your existing choice.');}
 catch(error){aiGet('aiSuggestionConsent').checked=false;aiGet('approveAiSuggestion').disabled=true;aiStatus(error.message||'Suggestion was not applied. Review again.');}
};
aiGet('cancelAiSuggestion').onclick=aiCancel;
aiGet('aiSuggestionDialog').addEventListener('cancel',event=>{event.preventDefault();aiCancel();});
aiGet('aiSuggestionDialog').addEventListener('close',()=>{if(!aiGet('aiSuggestionDialog').open){aiGeneration++;aiClearReview();}});
// Any local edit/restore invalidates consent; final content comparison also rejects stale reviews.
aiBridge.subscribe(()=>{if(aiReview){aiGet('aiSuggestionConsent').checked=false;aiGet('approveAiSuggestion').disabled=true;aiStatus('The workspace changed. This preview cannot be approved; generate and review a fresh suggestion.');}});

// Leaving this focused screen also cancels an in-flight read/hash, before a dialog exists.
let aiRoute=window.familyFramesUI?.getRoute();
window.familyFramesUI?.subscribe(route=>{if(aiRoute?.split('/')[0]==='ai'&&route.split('/')[0]!=='ai')aiCancel();aiRoute=route;});
