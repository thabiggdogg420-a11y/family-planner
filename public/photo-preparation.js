export const photoLimits={input:8*1024*1024,pixels:40000000,side:1920,preview:480};
export function fittedSize(width,height,maxSide){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>photoLimits.pixels)throw new Error('Use a photo under 40 megapixels.');
 const scale=Math.min(1,maxSide/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export async function preparePhoto(file,{imageFactory=()=>new Image(),canvasFactory=()=>document.createElement('canvas'),urlApi=URL}={}){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>photoLimits.input||file.size<1)throw new Error('Choose JPEG, PNG or WebP up to 8 MiB. Convert HEIC first.');
 const source=urlApi.createObjectURL(file);
 try{
  const image=imageFactory();image.src=source;try{await image.decode();}catch{throw new Error('This image could not be decoded. It may be damaged or use an unsupported format; try another JPEG, PNG or WebP.');}
  async function encode(maxSide,quality){const size=fittedSize(image.naturalWidth,image.naturalHeight,maxSide),canvas=canvasFactory();Object.assign(canvas,size);const g=canvas.getContext('2d');if(!g)throw new Error('Photo preparation unavailable.');g.fillStyle='#faf7ee';g.fillRect(0,0,size.width,size.height);g.drawImage(image,0,0,size.width,size.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(!blob||blob.type!=='image/jpeg'||blob.size>photoLimits.input)throw new Error('Photo could not be prepared within the upload limit.');return blob;}
  // Only fresh canvas output is uploaded; original EXIF/GPS and filenames are not sent.
  let blob;for(const [side,quality]of [[1920,.87],[1920,.75],[1600,.7],[1280,.65]]){blob=await encode(side,quality);if(blob.size<=2*1024*1024)break;}if(blob.size>2*1024*1024)throw new Error('Prepared photo exceeds the pilot 2 MiB limit.');return {blob,preview:await encode(photoLimits.preview,.75)};
 }finally{urlApi.revokeObjectURL(source);}
}
export async function uploadPayload(blob,uploadId){
 const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return {uploadId,mime:'image/jpeg',data:btoa(binary)};
}
