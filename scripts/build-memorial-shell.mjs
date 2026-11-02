import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const dir=new URL('../public/',import.meta.url);
const paths=['/memorial-usage.js','/planning-comparison-model.js','/planning-comparison-ui.js','/first-hours-model.js','/first-hours-ui.js','/afterward-model.js','/afterward-ui.js','/ceremony-montage-model.js','/ceremony-montage-media.js','/ceremony-montage-ui.js','/ceremony-sequence-model.js','/ceremony-sequence-ui.js','/ceremony-flow-model.js','/ceremony-flow-ui.js','/planning-guided-ui.js','/guided-model.js','/planning-outcomes-ui.js','/outcomes-model.js','/memorial-shell.js','/planning-ai.js','/planning-ai-ui.js','/planning-ui.js','/planning-model.js','/planning-catalog.js','/memorial.css','/memorial.js','/memorial-model.js','/memorial-install.js','/memorial-backup.js','/photo-preparation.js','/memorial.webmanifest','/memorial-icon-192.png','/memorial-icon-512.png'];
export async function shellSource(){
 const assets={};for(const path of paths)assets[path]=createHash('sha256').update(await readFile(new URL(path.slice(1),dir))).digest('hex');
 const template=await readFile(new URL('./memorial-sw-template.js',import.meta.url),'utf8');const html=await readFile(new URL('memorial.html',dir),'utf8');
 const version=createHash('sha256').update(JSON.stringify(assets)+template+html).digest('hex').slice(0,24);
 const prefix='/memorial-offline-assets/'+version+'/';
 const offline=html.replace(/<link rel="(?:manifest|apple-touch-icon)"[^>]*>/g,'').replace(/(src|href)="\/((?:memorial|planning-|ceremony-|afterward-)[^"/]*\.(?:js|css))"/g,(_,attr,file)=>`${attr}="${prefix}${file}"`).replace('<body>','<body><aside class="notice offline-banner">Offline app interface · your private plan is not part of this cached interface. Restore an explicitly saved workspace or review a private backup. The photo-room host and external guidance need a connection.</aside>');
 return `// Generated; run node scripts/build-memorial-shell.mjs after changing app-shell files.\nconst SHELL_VERSION=${JSON.stringify(version)};\nconst SHELL_ASSETS=${JSON.stringify(assets,null,2)};\nconst OFFLINE_DOCUMENT=${JSON.stringify(offline)};\n${template}`;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await writeFile(new URL('memorial-sw.js',dir),await shellSource());
