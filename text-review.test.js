const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(page,language){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const storage=language==='bg'?{}:{'forme-language':language};
 const c={window:{addEventListener(){},scrollTo(){}},document,localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}},location:{hash:page},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);
 for(const f of ['exercise-art.js','data.js','exercise-photos.js','core.js','food-art.js','food-photos.js','i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js','state-normalizer.js','storage-schema.js','progress.js','programs.js','nutrition-journal.js','backup.js','app.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {nodes};
}

function translationApi(){
 const c={window:{}};
 vm.createContext(c);
 vm.runInContext(fs.readFileSync('interface-translations.js','utf8'),c,{filename:'interface-translations.js'});
 return c.window.FORME_INTERFACE_TRANSLATIONS;
}
const T=translationApi();

const screens=[
 ['#home','home.eyebrow'],
 ['#sessions','workouts.eyebrow'],
 ['#exercises','exercises.eyebrow'],
 ['#nutrition','nutrition.eyebrow'],
 ['#plan','plan.eyebrow'],
 ['#progress','progress.eyebrow'],
 ['#favorites','favorites.eyebrow']
];

function checkScreen(page,eyebrowKey,language){
 const a=boot(page,language);
 const html=a.nodes.app.innerHTML;
 assert.ok(html.length>200,`${language} ${page} renders content`);
 assert.match(html,/<h[12][ >]/,`${language} ${page} keeps a page heading`);
 const eyebrow=T.get(eyebrowKey,language);
 assert.ok(eyebrow,`${eyebrowKey} exists in ${language}`);
 assert.ok(html.includes(eyebrow),`${language} ${page} shows its own heading text`);
 const results=[html,a.nodes['workout-results'].innerHTML,a.nodes['exercise-results'].innerHTML,a.nodes['food-results'].innerHTML]
  .join(' ')
  .replace(/data:image\/svg\+xml[^"']*/g,'');
 assert.doesNotMatch(results,/undefined|\[object Object\]|\bNaN\b/,`${language} ${page} has no leftover artifacts`);
 assert.doesNotMatch(results,/TODO|FIXME|lorem ipsum/i,`${language} ${page} has no unfinished placeholders`);
 return results;
}

for(const language of ['bg','en','de']){
 test(`all seven screens render in ${language} without leftover text artifacts`,()=>{
  for(const [page,eyebrowKey] of screens)checkScreen(page,eyebrowKey,language);
 });
}

test('the language sweep really switches language instead of falling back silently',()=>{
 const bg=checkScreen('#sessions','workouts.eyebrow','bg');
 const en=checkScreen('#sessions','workouts.eyebrow','en');
 const de=checkScreen('#sessions','workouts.eyebrow','de');
 assert.ok(bg.includes('ИЗБЕРИ ПОДХОДЯЩАТА ТРЕНИРОВКА'));
 assert.ok(en.includes('FIND YOUR WORKOUT'));
 assert.ok(de.includes('FINDE DEIN TRAINING'));
 assert.equal(checkScreen('#plan','plan.eyebrow','en').includes('My weekly plan'),true);
 assert.equal(checkScreen('#progress','progress.eyebrow','de').includes('Fortschritt'),true);
});
