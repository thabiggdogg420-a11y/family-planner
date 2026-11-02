// Local-only media contract. No planner mutation, network, storage or device capture.
export const montageLimits=Object.freeze({images:12,input:8*1024*1024,totalInput:32*1024*1024,pixels:16000000,prepared:1024*1024,seconds:120,holdMin:1,holdMax:15,caption:120,width:1280,height:720,fps:10,output:32*1024*1024});
const fail=message=>{throw Error(message);};
export function rasterDimensions(bytes,mime){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength);let width=0,height=0;
 const str=(i,n)=>String.fromCharCode(...b.slice(i,i+n));
 if(mime==='image/png'){
  if(b.length<33||[137,80,78,71,13,10,26,10].some((x,i)=>b[i]!==x)||str(12,4)!=='IHDR'||v.getUint32(8)!==13)fail('This is not a valid PNG header.');
  width=v.getUint32(16);height=v.getUint32(20);let p=8,headers=0,ended=false;
  while(p+12<=b.length){const size=v.getUint32(p),kind=str(p+4,4);if(p+12+size>b.length)fail('The PNG is truncated.');if(kind==='acTL')fail('Use a still PNG, not an animated image.');if(kind==='IHDR'&&++headers>1)fail('The PNG has conflicting size headers.');p+=12+size;if(kind==='IEND'){if(size!==0||p!==b.length)fail('The PNG ending is damaged.');ended=true;break;}}
  if(!ended)fail('The PNG is truncated.');
 }else if(mime==='image/jpeg'){
  if(b.length<4||b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)fail('This is not a supported complete JPEG.');let p=2;
  while(p+1<b.length){if(b[p++]!==255)fail('The JPEG header is damaged.');while(b[p]===255)p++;const marker=b[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;if(p+2>b.length)fail('The JPEG is truncated.');const size=v.getUint16(p);if(size<2||p+size>b.length)fail('The JPEG is truncated.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8||width)fail('The JPEG has an unsupported size header.');height=v.getUint16(p+3);width=v.getUint16(p+5);}p+=size;}
 }else if(mime==='image/webp'){
  if(b.length<20||str(0,4)!=='RIFF'||str(8,4)!=='WEBP'||v.getUint32(4,true)+8!==b.length)fail('This is not a valid WebP header.');let p=12,extended=null;
  while(p+8<=b.length){const kind=str(p,4),size=v.getUint32(p+4,true),q=p+8;if(q+size>b.length)fail('The WebP is truncated.');
   if(kind==='ANIM'||kind==='ANMF')fail('Use a still WebP, not an animated image.');
   if(kind==='VP8X'){if(size!==10||extended)fail('The WebP size header is damaged.');if(b[q]&2)fail('Use a still WebP, not an animated image.');extended={width:1+b[q+4]+b[q+5]*256+b[q+6]*65536,height:1+b[q+7]+b[q+8]*256+b[q+9]*65536};}
   else if(kind==='VP8 '){if(width||size<10||b[q+3]!==157||b[q+4]!==1||b[q+5]!==42)fail('The WebP size header is damaged.');width=v.getUint16(q+6,true)&16383;height=v.getUint16(q+8,true)&16383;}
   else if(kind==='VP8L'){if(width||size<5||b[q]!==47)fail('The WebP size header is damaged.');width=1+b[q+1]+((b[q+2]&63)<<8);height=1+(b[q+2]>>6)+(b[q+3]<<2)+((b[q+4]&15)<<10);}
   p=q+size+(size%2);
  }
  if(p!==b.length||extended&&(extended.width!==width||extended.height!==height))fail('The WebP has conflicting or truncated dimensions.');
 }else fail('Choose a still JPEG, PNG or WebP. SVG, GIF and HEIC are not supported.');
 if(!width||!height||width*height>montageLimits.pixels)fail('Use a still image with at most 16 megapixels.');return {width,height};
}
export function validateSelection(files,currentCount=0){if(!files.length)fail('Choose at least one image.');if(currentCount+files.length>montageLimits.images)fail('Use at most 12 images.');let total=0;for(const f of files){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size<1||f.size>montageLimits.input)fail('Each image must be JPEG, PNG or WebP, at most 8 MiB.');total+=f.size;}if(total>montageLimits.totalInput)fail('Select at most 32 MiB at a time.');return total;}
export function reviewMontage(items){if(!Array.isArray(items)||!items.length||items.length>montageLimits.images)fail('Choose between 1 and 12 images.');const ids=new Set();let total=0;const rows=items.map((r,i)=>{if(typeof r.id!=='string'||ids.has(r.id)||!(r.blob instanceof Blob)||r.blob.type!=='image/jpeg'||r.blob.size<1||r.blob.size>montageLimits.prepared)fail('An image is no longer prepared. Choose it again.');ids.add(r.id);if(typeof r.caption!=='string'||Array.from(r.caption).length>montageLimits.caption)fail('Keep each caption within 120 characters.');if(!Number.isInteger(r.seconds)||r.seconds<1||r.seconds>15)fail('Choose a whole number from 1 to 15 seconds per image.');total+=r.seconds;return Object.freeze({id:r.id,blob:r.blob,caption:r.caption,seconds:r.seconds,sample:r.sample===true,number:i+1});});if(total>120)fail('Keep the montage within 120 seconds.');return Object.freeze({items:Object.freeze(rows),seconds:total,width:1280,height:720,fps:10});}
export function montageKey(items){return JSON.stringify(items.map(r=>[r.id,r.caption,r.seconds,r.sample===true]));}
export function selectedWebmType(Recorder){if(typeof Recorder!=='function'||typeof Recorder.isTypeSupported!=='function')return null;for(const t of ['video/webm;codecs=vp8','video/webm']){try{if(Recorder.isTypeSupported(t))return t;}catch{}}return null;}
export function containSize(width,height,maxWidth,maxHeight){const scale=Math.min(maxWidth/width,maxHeight/height);return {width:width*scale,height:height*scale,x:(maxWidth-width*scale)/2,y:(maxHeight-height*scale)/2};}
export function captionLines(context,text,maxWidth){const lines=[];for(const paragraph of text.split(/\r?\n/)){let line='';for(const char of Array.from(paragraph)){if(line&&context.measureText(line+char).width>maxWidth){lines.push(line);line='';}line+=char;}lines.push(line);}return lines;}
