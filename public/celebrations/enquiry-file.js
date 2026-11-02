// Plain-text draft only: no mail client, recipient delivery, calendar or transaction.
import {packetCurrent} from './research.js';
export function createEnquiryFile(o,packet){
 if(!packetCurrent(o,packet))throw Error('The enquiry changed. Prepare and review a fresh packet before creating a file.');
 const c=packet.copy;
 const text=['UNSENT ENQUIRY DRAFT — NOT A BOOKING OR AUTHORIZATION',
 'This local file has not been sent. Verify its contents and destination before any manual sharing.',
 'Requested action: enquiry only. Authorization: not granted. Dispatch: not sent. Booking/payment: forbidden.',
 '',`Candidate: ${c.candidateName}`,`Public source destination (not a verified recipient): ${c.destinationUrl}`,
 `Requested date: ${c.date||'Not selected — ask separately'}`,`Requested time: ${c.time?c.time+' (venue-local time; timezone not established)':'Not selected'}`,
 '', 'DRAFT MESSAGE',c.message,'','UNRESOLVED',...c.unknowns.map(x=>'- '+x),'',
 'Do not treat this file as an invitation, delivered enquiry, supplier acceptance, reservation or payment authority.',''].join('\n');
 return {filename:`unsent-enquiry-${c.optionId}.txt`,mime:'text/plain;charset=utf-8',text,packet:structuredClone(packet)};
}
export function enquiryFileCurrent(o,file){try{if(!file||typeof file!=='object'||Array.isArray(file)||Object.keys(file).length!==4||!['filename','mime','text','packet'].every(k=>Object.hasOwn(file,k)))return false;return JSON.stringify(createEnquiryFile(o,file.packet))===JSON.stringify(file);}catch{return false;}}
