const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const docs=['README.md','DEV.md','DEMO.md','QA-MOBILE.md','QA-ACCESSIBILITY.md','QA-PWA-UPDATE.md','QA-RESILIENCE.md','MEDIA-DELIVERY-CHECKLIST.md','CONTENT-AUDIT.md','ROADMAP.md','QA-AUDIO.md','QA-JOURNAL.md'];

function localRefs(html){
 return [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(m=>m[1])
  .filter(target=>!/^(https?:|mailto:|#|data:)/.test(target))
  .map(target=>target.replace(/^\.\//,'').split('#')[0])
  .filter(Boolean);
}

test('every local link in the documentation resolves to a real file',()=>{
 let checked=0;
 for(const doc of docs){
  const text=fs.readFileSync(doc,'utf8');
  for(const m of text.matchAll(/\]\(([^)\s]+)\)/g)){
   const target=m[1];
   if(/^(https?:|mailto:|#)/.test(target))continue;
   const path=target.replace(/^\.\//,'').split('#')[0];
   if(!path)continue;
   assert.ok(fs.existsSync(path),`${doc}: broken local link -> ${target}`);
   checked++;
  }
 }
 assert.ok(checked>=20,'sanity: the docs contain plenty of local links');
});

test('the app shell references only files that exist',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const refs=localRefs(html);
 assert.ok(refs.length>=20,'sanity: the shell links its assets');
 for(const path of refs)
  assert.ok(fs.existsSync(path),`index.html references a missing file -> ${path}`);
});

test('every shell asset is listed in the service worker for offline use',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const sw=fs.readFileSync('service-worker.js','utf8');
 const assetsBlock=sw.match(/const ASSETS = \[([\s\S]*?)\];/);
 assert.ok(assetsBlock,'service worker declares its ASSETS list');
 const assets=new Set([...assetsBlock[1].matchAll(/'([^']+)'/g)].map(m=>m[1].replace(/^\.\//,'')).filter(Boolean));
 assert.ok(assets.size>=20,'sanity: the offline asset list is populated');
 for(const path of localRefs(html))
  assert.ok(assets.has(path),`index.html asset "${path}" is not cached for offline use`);
 for(const path of assets)
  assert.ok(fs.existsSync(path),`service worker caches a missing file -> ${path}`);
});
