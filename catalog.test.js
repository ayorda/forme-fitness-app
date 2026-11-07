const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function createApp(saved={},translated=false,page='#exercises'){
 const handlers={},nodes={},storage={...saved};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}};
 const c={window,document,localStorage,location:{hash:page},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);
 const files=['exercise-art.js','data.js','core.js','food-art.js'];if(translated)files.push('i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js');files.push('app.js');
 for(const f of files)vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {handlers,nodes,storage};
}
test('catalog searches by English name and shows honest missing-media placeholder',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Iron Cross'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Железен кръст/);assert.match(html,/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);assert.doesNotMatch(html,/<img[^>]+src=""/);
});
test('existing drawn exercise media is described as illustration rather than photography',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Планк'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Илюстрации и инструкции/);
 assert.doesNotMatch(html,/Снимки и инструкции/);
});
test('new exercise details show requirements and can be saved as favorite',()=>{
 const a=createApp();
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Iron_Cross'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/Преди да започнеш/);assert.match(a.nodes['modal-root'].innerHTML,/квалифициран треньор/);
 assert.match(a.nodes['modal-root'].innerHTML,/Видео демонстрацията предстои/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Iron_Cross'}})}});
 assert.ok(JSON.parse(a.storage['forme-favorites']).exercises.includes('Iron_Cross'));
 const b=createApp(a.storage);assert.match(b.nodes['exercise-results'].innerHTML,/Премахни от любими/);
});

test('squat withholds its inaccurate illustration until a verified demonstration is available',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Клек със собствено тегло'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Клек със собствено тегло/);assert.match(html,/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);assert.doesNotMatch(html,/bodyweight-squat/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Bodyweight_Squat'}})}});
 const detail=a.nodes['modal-root'].innerHTML;assert.match(detail,/Как се изпълнява/);assert.match(detail,/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);assert.doesNotMatch(detail,/<img/);
});
test('translated exercise search keeps stable IDs and preserves Bulgarian default',()=>{
 for(const [language,name] of [['en','Pull-Ups'],['de','Klimmzüge im Obergriff']]){
  const a=createApp({'forme-language':language},true);
  a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:name}});
  const html=a.nodes['exercise-results'].innerHTML;
  assert.match(html,/data-id="Pullups"/);assert.ok(html.includes(name));assert.match(a.nodes.app.innerHTML,language==='en'?/Search exercises/:/Übung suchen/);
  a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Pullups'}})}});
  assert.ok(a.nodes['modal-root'].innerHTML.includes(name));
 }
 const bg=createApp();assert.match(bg.nodes.app.innerHTML,/Търси упражнение/);
});
test('translated food search keeps the USDA nutrient values and stable food IDs',()=>{
 for(const [language,name] of [['en','Turkey breast'],['de','Putenbrust']]){
  const a=createApp({'forme-language':language},true,'#nutrition');
  a.handlers.input({target:{dataset:{filter:'foods',key:'q'},value:name}});
  const html=a.nodes['food-results'].innerHTML;
  assert.ok(html.includes(name));assert.match(html,/data-id="turkey"/);assert.match(html,/<strong>114<\/strong> kcal/);
  a.handlers.click({target:{closest:()=>({dataset:{action:'food-detail',id:'turkey'}})}});
  const detail=a.nodes['modal-root'].innerHTML;
  assert.ok(detail.includes(name));assert.match(detail,/114 kcal/);
  assert.match(detail,language==='en'?/<th>Nutrient<\/th>/:/<th>Nährwert<\/th>/);
  assert.match(detail,language==='en'?/23.7 g/:/23,7 g/);
 }
});
test('meal calculator uses translated food state while keeping the same total',()=>{
 for(const [language,name,state] of [['en','Turkey breast','raw, meat only'],['de','Putenbrust','roh, nur Fleisch']]){
  const a=createApp({'forme-language':language,'forme-current-meal':JSON.stringify([{id:'turkey',grams:'100'}])},true,'#nutrition');
  a.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'meal'}})}});
  assert.ok(a.nodes.app.innerHTML.includes(name+' · '+state));
  assert.match(a.nodes.app.innerHTML,/114 <span>kcal<\/span>/);
  assert.match(a.nodes.app.innerHTML,/data-index="0"/);
 }
});
test('weekly plan shows localized workout names without changing saved IDs',()=>{
 for(const [language,heading,workout] of [['en','My weekly plan','Strong Foundation'],['de','Mein Wochenplan','Starke Grundlage']]){
  const saved=JSON.stringify({mon:'cal-start'}),a=createApp({'forme-language':language,'forme-plan':saved},true,'#plan');
  assert.ok(a.nodes.app.innerHTML.includes(heading));assert.ok(a.nodes.app.innerHTML.includes(workout));
  assert.match(a.nodes.app.innerHTML,/value="cal-start" selected/);assert.equal(a.storage['forme-plan'],saved);
 }
});
