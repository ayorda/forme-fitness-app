const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup({online=true,responder=null}={}) {
  const scope='https://example.test/';
  const media=new Map([
    [new URL('./media/foods/banana-480.webp',scope).href,'old banana'],
    [new URL('./media/foods/banana-960.webp',scope).href,'old banana large'],
    [new URL('./media/foods/banana-v2-480.webp',scope).href,'three bananas'],
    [new URL('./media/foods/banana-v2-960.webp',scope).href,'three bananas large'],
    [new URL('./media/foods/apple-480.webp',scope).href,'apple']
  ]);
  const handlers={},stored=new Map([['forme-old',new Map()],['forme-media-v029',new Map()],['forme-media-v029-optimized',media],['unrelated-app',new Map()]]);
  let claimed=false,skipped=false;
  class Request {constructor(path,options){this.path=path;this.url=new URL(path,scope).href;this.cache=options?.cache;}}
  const caches={
    async open(name){if(!stored.has(name))stored.set(name,new Map());return {
      async addAll(paths){for(const path of paths)stored.get(name).set(path.path||path,`cached:${path.path||path}`);},
      async match(req){const key=typeof req==='string'?req:req.url;return stored.get(name).get(key);},
      async put(req,res){const key=typeof req==='string'?req:req.url;stored.get(name).set(key,res);},
      async delete(path){return stored.get(name).delete(path);}
    };},
    async keys(){return [...stored.keys()];},
    async delete(name){return stored.delete(name);},
    async match(path){const key=typeof path==='string'?path:path.url;for(const cache of stored.values())if(cache.has(key))return cache.get(key);}
  };
  const self={location:{origin:'https://example.test'},registration:{scope},clients:{async claim(){claimed=true;}},async skipWaiting(){skipped=true;},addEventListener(type,fn){handlers[type]=fn;}};
  const fetch=async (request,opts)=>{if(responder)return responder(request,opts);if(!online)throw Error('offline');return `network:${request.url}`;};
  const Response={error(){return {ok:false,status:0};}};
  vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self,caches,fetch,URL,Promise,Request,Response});
  return {handlers,stored,get claimed(){return claimed;},get skipped(){return skipped;}};
}
async function lifecycle(handler){let task;handler({waitUntil(p){task=p;}});await task;}
async function respond(handler,request){let task;handler({request,respondWith(p){task=p;}});return task;}

test('installation caches the app and activation removes only old FORME caches',async()=>{
  const a=setup();await lifecycle(a.handlers.install);await lifecycle(a.handlers.activate);
  assert.equal(a.skipped,true);assert.equal(a.claimed,true);
  assert.equal(a.stored.has('forme-old'),false);assert.equal(a.stored.has('unrelated-app'),true);
  assert.equal(a.stored.has('forme-media-v029'),false);
  const media=a.stored.get('forme-media-v029-optimized');
  assert.equal(media.has('https://example.test/media/foods/banana-480.webp'),false);
  assert.equal(media.has('https://example.test/media/foods/banana-960.webp'),false);
  assert.equal(media.has('https://example.test/media/foods/banana-v2-480.webp'),false);
  assert.equal(media.has('https://example.test/media/foods/banana-v2-960.webp'),false);
  assert.equal(media.has('https://example.test/media/foods/apple-480.webp'),true);
  const cache=[...a.stored.entries()].find(([name])=>name.startsWith('forme-mobile-'))[1];
  for(const asset of ['./index.html','./app.js','./data.js','./styles.css','./food-photos.js','./i18n.js','./interface-translations.js','./exercise-translations.js','./food-translations.js','./workout-translations.js','./locale-content.js','./icon-192.png','./icon-512.png'])assert.ok(cache.has(asset),asset);
});

test('offline navigation opens the saved app and external requests are left alone',async()=>{
  const a=setup({online:false});await lifecycle(a.handlers.install);
  const result=await respond(a.handlers.fetch,{method:'GET',mode:'navigate',url:'https://example.test/plan'});
  assert.equal(result,'cached:./index.html');
  let intercepted=false;a.handlers.fetch({request:{method:'GET',url:'https://other.test/photo.jpg'},respondWith(){intercepted=true;}});
  assert.equal(intercepted,false);
});

test('viewed WebP media is cached on ok responses, served offline, and non-OK responses are not cached',async()=>{
  let isOnline=true,nextOk=true;
  const a=setup({responder:async req=>{
    if(!isOnline)throw Error('offline');
    return {ok:nextOk,url:req.url,clone(){return {ok:nextOk,url:req.url,cached:true};}};
  }});
  await lifecycle(a.handlers.install);
  const plankUrl='https://example.test/media/exercises/Plank-480.webp';
  const brokenUrl='https://example.test/media/exercises/Missing-480.webp';
  const fetched=await respond(a.handlers.fetch,{method:'GET',url:plankUrl});
  assert.equal(fetched.ok,true);
  nextOk=false;
  const failed=await respond(a.handlers.fetch,{method:'GET',url:brokenUrl});
  assert.equal(failed.ok,false);
  assert.equal(a.stored.get('forme-media-v029-optimized').has(brokenUrl),false);
  isOnline=false;
  const fromCache=await respond(a.handlers.fetch,{method:'GET',url:plankUrl});
  assert.equal(fromCache.cached,true);
  const uncachedOffline=await respond(a.handlers.fetch,{method:'GET',url:brokenUrl});
  assert.equal(uncachedOffline.ok,false);
});

test('navigation fallback serves cached index.html when network returns an HTTP error status',async()=>{
  const a=setup({responder:async()=>({ok:false,status:503})});
  await lifecycle(a.handlers.install);
  const result=await respond(a.handlers.fetch,{method:'GET',mode:'navigate',url:'https://example.test/progress'});
  assert.equal(result,'cached:./index.html');
});
