const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function translationApi(){
 const c={window:{}};
 vm.createContext(c);
 vm.runInContext(fs.readFileSync('interface-translations.js','utf8'),c,{filename:'interface-translations.js'});
 return c.window.FORME_INTERFACE_TRANSLATIONS;
}
const T=translationApi();
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const source=fs.readFileSync('interface-translations.js','utf8');

test('every interface key the app asks for exists in all three languages',()=>{
 const requested=[];
 for(const m of app.matchAll(/textFor\(\s*'([^']+)'/g)){
  const key=m[1];
  if(key.endsWith('.'))continue; // dynamic prefix such as 'category.' + value
  requested.push(key);
 }
 assert.ok(requested.length>250,'sanity: the app requests many literal keys');
 for(const key of requested)
  assert.ok(T.keys.includes(key),`missing interface translation for "${key}" in app.js`);
 const shellKeys=[...html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(shellKeys.length>=10,'sanity: the shell marks its translatable nodes');
 for(const key of shellKeys)
  assert.ok(T.keys.includes(key),`missing interface translation for "${key}" in index.html`);
});

test('interface-translations.js has no duplicate keys silently overwriting each other',()=>{
 const keys=[...source.matchAll(/^\s*'([^']+)':\s*\[/gm)].map(m=>m[1]);
 assert.ok(keys.length>=300,'sanity: parsed every translation row');
 const seen=new Map();
 for(const key of keys){
  seen.set(key,(seen.get(key)||0)+1);
  assert.equal(seen.get(key),1,`duplicate interface key "${key}"`);
 }
 assert.equal(keys.length,T.keys.length,'parsed keys match the exported key list');
});

test('every interface translation key is still referenced by the app or the shell',()=>{
 const dynPrefixes=[...new Set([...app.matchAll(/textFor\(\s*'([a-zA-Z0-9_.]+)'\s*\+/g)].map(m=>m[1]))];
 const dead=[];
 for(const key of T.keys){
  const referenced=app.includes(`'${key}'`)||
   app.includes(`"${key}"`)||
   html.includes(key)||
   dynPrefixes.some(prefix=>key.startsWith(prefix));
  if(!referenced)dead.push(key);
 }
 assert.deepEqual(dead,[],`unused interface keys (wire them up or remove them): ${dead.join(', ')}`);
});
