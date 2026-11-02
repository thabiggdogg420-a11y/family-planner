import {validateData,parseSnapshot} from './retention.js';
export const MAX_BACKUP_BYTES=1000000;
const size=text=>new TextEncoder().encode(text).length;
// Files are private local copies, not invitations, cloud saves or delivery receipts.
export function createBackup(data){
 const checked=validateData(data);
 const text=JSON.stringify({format:'family-occasions-private-draft',version:12,revision:'portable-backup',data:checked},null,2)+'\n';
 if(size(text)>MAX_BACKUP_BYTES)throw Error('Backup exceeds the 1 MB file limit. Nothing downloaded.');
 return {text,mime:'application/json',filename:'family-occasions-private-backup.json'};
}
export function readBackup(text){
 if(typeof text!=='string'||size(text)>MAX_BACKUP_BYTES)throw Error('Choose a backup no larger than 1 MB.');
 const parsed=JSON.parse(text,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('Backup contains an unsafe field.');return value;});
 // The strict existing schema also migrates supported older drafts; unknown data fails closed.
 return parseSnapshot(JSON.stringify(parsed)).data;
}
export function createBackupSession({getData,getGeneration,isBusy,replaceSession}){
 let review=null,serial=0;
 const generation=()=>JSON.stringify([getGeneration(),getData()]);
 function clear(){review=null;serial++;}
 function valid(){return review&&!isBusy()&&review.base===generation();}
 return {clear,
  exportReview(){clear();if(isBusy())throw Error('Wait for the local draft operation to finish.');review={kind:'export',base:generation(),file:createBackup(getData())};return structuredClone(review);},
  async importReview(file){clear();if(isBusy())throw Error('Wait for the local draft operation to finish.');if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_BACKUP_BYTES)throw Error('Choose a backup no larger than 1 MB.');const ticket=serial,base=generation();let text;try{text=await file.text();}catch(error){if(ticket!==serial)return null;throw error;}if(ticket!==serial)return null;if(base!==generation()||isBusy())throw Error('The plan changed while reading. Select the backup again.');const data=readBackup(text);review={kind:'import',base,data,file:createBackup(data)};return structuredClone(review);},
  download(approved){if(!approved||!valid()||review.kind!=='export')throw Error('Review and approve the current backup again.');return {...review.file};},
  apply(approved){if(!approved||!valid()||review.kind!=='import')throw Error('Review and approve the backup again. Nothing replaced.');const data=validateData(review.data);clear();replaceSession(data);return true;},
  current(){return !!valid();}
 };
}
