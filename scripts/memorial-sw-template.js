// Build-time constants contain only app-owned static code. No served HTML or private data is cached.
const CACHE_PREFIX='family-frames-memorial-shell-';
const CACHE_NAME=CACHE_PREFIX+SHELL_VERSION;
const VIRTUAL_PREFIX='/memorial-offline-assets/'+SHELL_VERSION+'/';
function eligibleURL(request){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.origin!==self.location.origin||u.search||u.hash||request.headers.has('authorization')||request.headers.has('range'))return null;
 return u;
}
async function verifiedAsset(path,expected){
 const response=await fetch(new Request(new URL(path,self.location.origin),{cache:'no-store',credentials:'same-origin',redirect:'error'}));
 const actual=new URL(response.url);
 if(response.status!==200||response.type!=='basic'||response.redirected||actual.origin!==self.location.origin||actual.pathname!==path||actual.search)throw Error('App shell response did not match the requested static file.');
 const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
 const hex=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
 if(hex!==expected)throw Error('App shell integrity mismatch. No login, modified or private response was cached.');
 // Strip hosting headers and original response URL. A blank URL makes module imports resolve
 // relative to the versioned virtual request, never to an uncached original script path.
 const mime=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'application/manifest+json';
 return new Response(await response.arrayBuffer(),{headers:{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const verified=[];
 for(const [path,hash]of Object.entries(SHELL_ASSETS))verified.push([VIRTUAL_PREFIX+path.slice(1),await verifiedAsset(path,hash)]);
 const cache=await caches.open(CACHE_NAME);
 try{for(const [path,response]of verified)await cache.put(path,response);}catch(error){await caches.delete(CACHE_NAME);throw error;}
 // Never skipWaiting: open tabs keep their current code and unsaved edits.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)await caches.delete(name);
 // Never clients.claim(): a loaded page is not taken over mid-edit.
})()));
self.addEventListener('fetch',event=>{
 const u=eligibleURL(event.request);if(!u)return;
 if(u.pathname.startsWith(VIRTUAL_PREFIX)){
  const original='/'+u.pathname.slice(VIRTUAL_PREFIX.length);
  if(!Object.hasOwn(SHELL_ASSETS,original))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);return await cache.match(u.pathname)||new Response('This offline app file is missing. Reopen online and prepare the offline workspace again.',{status:503,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});})());return;
 }
 if(u.pathname!=='/memorial'||event.request.mode!=='navigate')return;
 event.respondWith((async()=>{
  let live;
  try{live=await fetch(event.request,{redirect:'manual',cache:'no-store'});}catch{
   // Generated from our source at build time, never from a hosting/authentication response.
   return new Response(OFFLINE_DOCUMENT,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
  }
  if(live.type==='opaqueredirect'||live.redirected||live.status>=300&&live.status<400)return new Response('The host redirected this workspace. Open the original host online and resolve sign-in/address requirements. Offline fallback was not used.',{status:409,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
  // Online HTML (including explicit errors) passes through without caching. Its original asset URLs
  // remain network-only, so it cannot accidentally mix with the offline version's cached scripts.
  return live;
 })());
});
