'use strict';
(function(root){
 const allowed=new Set(['landing','start','complete']),sent=new Set();
 const qa=()=>new URLSearchParams(root.location.search).get('gc_test')==='1'||new URLSearchParams(root.location.search).get('measurement_test')==='1';
 function record(event){if(qa()||!allowed.has(event)||sent.has(event))return;sent.add(event);try{Promise.resolve(root.fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event}),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true})).catch(()=>{});}catch{} }
 root.AggregateFunnel=Object.freeze({record});
 root.document?.addEventListener('click',event=>{if(!qa())return;const a=event.target.closest?.('a[href]');if(!a||a.hasAttribute('download'))return;try{const url=new URL(a.href,root.location.href);if(url.origin!==root.location.origin||(/\.[a-z0-9]+$/i.test(url.pathname)&&!url.pathname.endsWith('.html')))return;url.searchParams.set('measurement_test','1');a.href=url.href;}catch{}},true);
 if(root.location.pathname==='/'||root.location.pathname==='/index.html'||root.location.pathname==='/memorial'||root.location.pathname==='/memorial.html'||root.location.pathname==='/celebrations'||root.location.pathname==='/celebrations/'||root.location.pathname==='/celebrations/index.html')record('landing');
})(globalThis);
