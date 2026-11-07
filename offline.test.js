const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup({online=true}={}) {
  const handlers={},stored=new Map([['forme-old',new Map()],['unrelated-app',new Map()]]);
  let claimed=false,skipped=false;
  const caches={
    async open(name){if(!stored.has(name))stored.set(name,new Map());return {async addAll(paths){for(const path of paths)stored.get(name).set(path,`cached:${path}`);}};},
    async keys(){return [...stored.keys()];},
    async delete(name){return stored.delete(name);},
    async match(path){const key=typeof path==='string'?path:path.url;for(const cache of stored.values())if(cache.has(key))return cache.get(key);}
  };
  const self={location:{origin:'https://example.test'},clients:{async claim(){claimed=true;}},async skipWaiting(){skipped=true;},addEventListener(type,fn){handlers[type]=fn;}};
  const fetch=async request=>{if(!online)throw Error('offline');return `network:${request.url}`;};
  vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self,caches,fetch,URL,Promise});
  return {handlers,stored,get claimed(){return claimed;},get skipped(){return skipped;}};
}
async function lifecycle(handler){let task;handler({waitUntil(p){task=p;}});await task;}
async function respond(handler,request){let task;handler({request,respondWith(p){task=p;}});return task;}

test('installation caches the app and activation removes only old FORME caches',async()=>{
  const a=setup();await lifecycle(a.handlers.install);await lifecycle(a.handlers.activate);
  assert.equal(a.skipped,true);assert.equal(a.claimed,true);
  assert.equal(a.stored.has('forme-old'),false);assert.equal(a.stored.has('unrelated-app'),true);
  const cache=[...a.stored.entries()].find(([name])=>name.startsWith('forme-mobile-'))[1];
  for(const asset of ['./index.html','./app.js','./data.js','./styles.css','./i18n.js','./exercise-translations.js','./food-translations.js','./workout-translations.js','./icon-192.png','./icon-512.png'])assert.ok(cache.has(asset),asset);
});

test('offline navigation opens the saved app and external requests are left alone',async()=>{
  const a=setup({online:false});await lifecycle(a.handlers.install);
  const result=await respond(a.handlers.fetch,{method:'GET',mode:'navigate',url:'https://example.test/plan'});
  assert.equal(result,'cached:./index.html');
  let intercepted=false;a.handlers.fetch({request:{method:'GET',url:'https://other.test/photo.jpg'},respondWith(){intercepted=true;}});
  assert.equal(intercepted,false);
});
