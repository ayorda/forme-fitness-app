const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const URL_BASE='https://example.test/forme/';
const clip=URL_BASE+'media/exercise-videos/parallel-bar-dips-v1.mp4';
function setup({offline=false,cacheFailure=false,cacheOpenFailure=false,status=200}={}) {
 const stored=new Map(),calls=[],handlers={};
 const cache={async match(key){return stored.get(key)?.clone();},async put(key,value){if(cacheFailure)throw Error('quota');stored.set(key,value);}};
 const full=()=>new Response(Uint8Array.from([0,1,2,3,4,5,6,7,8,9]),{status,headers:{'Content-Type':'video/mp4','ETag':'"v1"'}});
 const fetch=async request=>{calls.push(request);if(offline)throw Error('offline');return full();};
 const self={location:{origin:new URL(URL_BASE).origin},registration:{scope:URL_BASE},addEventListener(type,fn){handlers[type]=fn;}};
 vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self,caches:{async open(){if(cacheOpenFailure)throw Error('disabled storage');return cache;}},fetch,Request,Response,Headers,URL});
 return {calls,stored,full,async get(range,url=clip,extra={}){let result;handlers.fetch({request:new Request(url,{headers:{...extra,...(range?{Range:range}:{})}}),respondWith(p){result=p;}});return result;}};
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
 assert.equal(assets.length,2);assert.ok(assets.every(path=>fs.existsSync(path.slice(2))));
 assert.doesNotMatch(source.match(/const ASSETS = ([^;]+);/)[1],/exercise-videos/);
});
