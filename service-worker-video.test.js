const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const URL_BASE='https://example.test/forme/';
const clip=URL_BASE+'media/exercise-videos/parallel-bar-dips-v2.mp4';
function setup({offline=false,cacheFailure=false,cacheOpenFailure=false,status=200}={}) {
 const stored=new Map(),legacy=new Map(),calls=[],handlers={};
 const stores=new Map([['forme-video-v0143-dips2',stored],['forme-media-v029-optimized',legacy],['unrelated-app',new Map()],['forme-video-old',new Map()]]);
 const caches={async open(name){
  if(cacheOpenFailure)throw Error('disabled storage');
  if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);
  return {async match(key){const value=data.get(key);return value?.clone?value.clone():value;},async put(key,value){if(cacheFailure&&['forme-video-v0143-dips2','forme-audio-v0150-original1'].includes(name))throw Error('quota');data.set(key,value);},async delete(key){return data.delete(key);}};
 },async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},async match(key){for(const data of stores.values())if(data.has(key))return data.get(key).clone();}};
 const full=()=>new Response(Uint8Array.from([0,1,2,3,4,5,6,7,8,9]),{status,headers:{'Content-Type':'video/mp4','ETag':'"v1"'}});
 const fetch=async request=>{calls.push(request);if(offline)throw Error('offline');return full();};
 const self={location:{origin:new URL(URL_BASE).origin},registration:{scope:URL_BASE},clients:{async claim(){}},addEventListener(type,fn){handlers[type]=fn;}};
 vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self,caches,fetch,Request,Response,Headers,URL});
 return {calls,stored,legacy,stores,full,async activate(){let task;handlers.activate({waitUntil(p){task=p;}});await task;},async get(range,url=clip,extra={}){let result;handlers.fetch({request:new Request(url,{headers:{...extra,...(range?{Range:range}:{})}}),respondWith(p){result=p;}});return result;}};
}
test('first video range fetch caches a complete body and supports offline seeking',async()=>{
 const s=setup(),response=await s.get('bytes=2-5');
 assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 2-5/10');assert.equal(response.headers.get('Content-Length'),'4');
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[2,3,4,5]);
 assert.equal(s.calls[0].headers.has('Range'),false);assert.equal(s.stored.get(clip).status,200);
 const offline=setup({offline:true});offline.stored.set(clip,s.stored.get(clip).clone());
 for(const [range,expected] of [['bytes=7-',[7,8,9]],['bytes=-3',[7,8,9]],['bytes=8-200',[8,9]],['bytes=-20',[0,1,2,3,4,5,6,7,8,9]]]) {
  const r=await offline.get(range);assert.equal(r.status,206);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],expected);
 }
 assert.equal(offline.calls.length,0);
});
test('invalid, multiple, zero-suffix and unsatisfiable video ranges return 416',async()=>{
 const s=setup();s.stored.set(clip,s.full());
 for(const range of ['bytes=10-','bytes=5-2','bytes=-0','bytes=-','bytes=0-1,3-4','bytes=a-b','bytes=9007199254740992-']) {
  const r=await s.get(range);assert.equal(r.status,416,range);assert.equal(r.headers.get('Content-Range'),'bytes */10');
 }
});
test('no Range and mismatched If-Range return the full response, matching validators permit ranges',async()=>{
 const s=setup();assert.equal((await s.get()).status,200);
 assert.equal((await s.get('bytes=0-1',clip,{'If-Range':'"old"'})).status,200);
 assert.equal((await s.get('bytes=0-1',clip,{'If-Range':'"v1"'})).status,206);
 assert.equal(s.calls.length,1);
});
test('cache quota failure preserves playback and network errors never become video bodies',async()=>{
 const s=setup({cacheFailure:true});assert.equal((await s.get('bytes=0-1')).status,206);assert.equal(s.stored.size,0);
 assert.equal((await setup({cacheOpenFailure:true}).get('bytes=0-1')).status,206);
 const error=setup({status:503});assert.equal((await error.get()).status,503);assert.equal(error.stored.size,0);
 const partial=setup({status:206});assert.equal((await partial.get()).status,206);assert.equal(partial.stored.size,0);
 await assert.rejects(setup({offline:true}).get('bytes=0-1'),/offline/);
});
test('only exact approved same-origin versioned media uses the range cache',async()=>{
 const s=setup();assert.equal(await s.get('bytes=0-1','https://other.test/clip.mp4'),undefined);
 // Other same-origin resources use the existing generic fetch path, with Range intact.
 const source=fs.readFileSync('service-worker.js','utf8');
 const assets=vm.runInNewContext(source.slice(0,source.indexOf('async function videoResponse'))+';VIDEO_ASSETS');
 const entries=JSON.parse(fs.readFileSync('media/exercise-videos/manifest.json','utf8')).entries;
 assert.equal(assets.length,42);assert.equal(new Set(assets).size,42);assert.ok(assets.every(path=>fs.existsSync(path.slice(2))));
 assert.deepEqual(Array.from(assets).sort(),entries.flatMap(e=>['./'+e.variants[0].path,'./'+e.poster.path]).sort());
 assert.doesNotMatch(source.match(/const ASSETS = ([^;]+);/)[1],/exercise-videos/);
});
test('every additional clip has an independent lazy full-body cache and offline range',async()=>{
 const entries=JSON.parse(fs.readFileSync('media/exercise-videos/manifest.json','utf8')).entries.slice(1);
 const online=setup();for(const entry of entries)assert.equal((await online.get('bytes=0-2',URL_BASE+entry.variants[0].path)).status,206);
 assert.equal(online.calls.length,20);assert.equal(online.stored.size,20);
 const offline=setup({offline:true});for(const [key,value] of online.stored)offline.stored.set(key,value.clone());
 for(const entry of entries){const r=await offline.get('bytes=-2',URL_BASE+entry.variants[0].path);assert.equal(r.status,206);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[8,9]);}
 assert.equal(offline.calls.length,0);await offline.activate();assert.equal(offline.stored.size,20);
});
test('upgrade migrates the unchanged full video, preserves images and removes the retired duplicate',async()=>{
 const s=setup({offline:true}),image=URL_BASE+'media/exercises/Plank-480.webp',retired=URL_BASE+'media/exercise-videos/parallel-bar-dips-v1.webm';
 s.legacy.set(clip,s.full());s.legacy.set(image,new Response('unchanged image'));s.legacy.set(retired,s.full());
 await s.activate();assert.equal(s.stored.get(clip).status,200);assert.equal(s.legacy.has(clip),false);assert.equal(s.legacy.has(retired),false);assert.equal(await s.legacy.get(image).text(),'unchanged image');
 assert.equal(s.stores.has('unrelated-app'),true);assert.equal(s.stores.has('forme-video-old'),false);
 assert.equal((await s.get('bytes=1-3')).status,206);assert.equal(s.calls.length,0);
});
test('failed migration leaves a usable old full body for offline playback',async()=>{
 const s=setup({offline:true,cacheFailure:true});s.legacy.set(clip,s.full());
 await s.activate();assert.equal(s.stored.size,0);assert.equal(s.legacy.get(clip).status,200);
 const response=await s.get('bytes=-2');assert.equal(response.status,206);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[8,9]);assert.equal(s.calls.length,0);
});
test('upgrade never migrates an incomplete video body',async()=>{
 const s=setup({offline:true});s.legacy.set(clip,new Response('partial',{status:206}));await s.activate();assert.equal(s.stored.size,0);
 await assert.rejects(s.get(),/offline/);
});
test('replacement never serves retired bytes under the new video URL',async()=>{
 const s=setup({offline:true}),retired=clip.replace('-v2.mp4','-v1.mp4'),image=URL_BASE+'media/exercises/Plank-480.webp';
 s.legacy.set(retired,s.full());s.legacy.set(image,new Response('keep image'));
 s.stores.get('forme-video-old').set(retired,s.full());
 await s.activate();assert.equal(s.stored.has(clip),false);assert.equal(s.legacy.has(retired),false);
 assert.equal(await s.legacy.get(image).text(),'keep image');
 await assert.rejects(s.get(),/offline/);
});

const audioURL=URL_BASE+'media/yoga-music/calm-v1.m4a';
test('music is cached only on selection, and its full body works offline',async()=>{
 const s=setup();assert.equal(s.stores.has('forme-audio-v0150-original1'),false);
 const r=await s.get(null,audioURL);assert.equal(r.status,200);assert.equal(s.calls.length,1);
 const saved=s.stores.get('forme-audio-v0150-original1');assert.equal(saved.size,1);
 const offline=setup({offline:true});offline.stores.set('forme-audio-v0150-original1',saved);
 assert.equal((await offline.get(null,audioURL)).status,200);assert.equal(offline.calls.length,0);
 await offline.activate();assert.equal(offline.stores.get('forme-audio-v0150-original1').size,1);
});
test('audio errors and partial responses never poison the music cache',async()=>{
 for(const status of [206,404,503]){const s=setup({status});assert.equal((await s.get(null,audioURL)).status,status);assert.equal(s.stores.get('forme-audio-v0150-original1').size,0);}
 await assert.rejects(setup({offline:true}).get(null,audioURL),/offline/);
 assert.equal((await setup({cacheOpenFailure:true}).get(null,audioURL)).status,200);
 const quota=setup({cacheFailure:true});assert.equal((await quota.get(null,audioURL)).status,200);assert.equal(quota.stores.get('forme-audio-v0150-original1').size,0);
});
test('no music recording is in the install shell and only versioned tracks use its cache',async()=>{
 const source=fs.readFileSync('service-worker.js','utf8');assert.doesNotMatch(source.match(/const ASSETS = ([^;]+);/)[1],/yoga-music/);
 const s=setup();await s.get(null,audioURL.replace('-v1.m4a','-unapproved.m4a'));assert.equal(s.stores.has('forme-audio-v0150-original1'),false);
});
