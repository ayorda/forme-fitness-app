const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(saved={}){
 const handlers={},nodes={},storage={...saved};let reloads=0;
 const element=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},querySelectorAll(){return [];},addEventListener(type,fn){handlers[type]=fn;}};
 const location={hash:'#nutrition',reload(){reloads++;}};
 const context={window:{addEventListener(){},scrollTo(){}},document,location,localStorage:{getItem:key=>storage[key]??null,setItem(key,value){storage[key]=value;}},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);
 for(const file of ['exercise-art.js','data.js','exercise-photos.js','core.js','food-art.js','food-photos.js','i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js','app.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return {handlers,nodes,storage,location,reloads:()=>reloads};
}

test('language picker persists choice and reloads the current page',()=>{
 const app=boot();assert.equal(app.nodes['language-select'].value,'bg');
 app.handlers.change({target:{id:'language-select',value:'en',dataset:{}}});
 assert.equal(app.storage['forme-language'],'en');assert.equal(app.reloads(),1);assert.equal(app.location.hash,'#nutrition');
 const reopened=boot(app.storage);assert.equal(reopened.nodes['language-select'].value,'en');
 assert.match(reopened.nodes.app.innerHTML,/Nutrition/);
 assert.match(reopened.nodes['food-results'].innerHTML,/Chicken breast/);
});

test('unsupported language cannot replace a saved choice',()=>{
 const app=boot({'forme-language':'de'});
 app.handlers.change({target:{id:'language-select',value:'fr',dataset:{}}});
 assert.equal(app.storage['forme-language'],'de');assert.equal(app.reloads(),0);
});

test('meal and food detail validation errors follow the selected language',()=>{
 for(const [language,range,format,noResults] of [
  ['en','The amount must be greater than 0 and at most 10,000 g.','Enter a positive amount in grams.','No matches'],
  ['de','Die Menge muss größer als 0 und höchstens 10.000 g sein.','Gib eine positive Menge in Gramm ein.','Keine Treffer']
 ]){
  const app=boot({'forme-language':language,'forme-current-meal':JSON.stringify([{id:'rice',grams:'0'}])});
  app.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'meal'}})}});
  assert.ok(app.nodes.app.innerHTML.includes(range),language+' stored meal');
  assert.ok(app.nodes.app.innerHTML.includes('class="grams-unit" aria-hidden="true">g</span>'),language+' unit');
  app.handlers.input({target:{dataset:{action:'meal-grams',index:'0'},value:'abc',classList:{toggle(){}}}});
  assert.equal(app.nodes['meal-error-0'].textContent,format,language+' meal edit');
  app.handlers.input({target:{dataset:{action:'detail-grams',id:'rice'},value:'0'}});
  assert.equal(app.nodes['detail-error'].textContent,range,language+' food detail');
  app.handlers.input({target:{dataset:{filter:'foods',key:'q'},value:'zzzz-no-food'}});
  assert.ok(app.nodes['food-results'].innerHTML.includes(noResults),language+' empty search');
 }
});

test('meal totals and saved meal counts use the selected language',()=>{
 const saved=[{name:'One',items:[{id:'rice',grams:'100'}]},{name:'Two',items:[{id:'rice',grams:'100'},{id:'chicken',grams:'100'}]}];
 for(const [language,one,many] of [['en','1 food','2 foods'],['de','1 Lebensmittel','2 Lebensmittel']]){
  const app=boot({'forme-language':language,'forme-current-meal':JSON.stringify(saved[0].items),'forme-saved-meals':JSON.stringify(saved)});
  app.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'meal'}})}});
  assert.ok(app.nodes.app.innerHTML.includes(' g</b>'),language+' macro units');
  assert.ok(!app.nodes.app.innerHTML.includes(' г</b>'),language+' no Cyrillic macro units');
  app.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'saved'}})}});
  assert.ok(app.nodes.app.innerHTML.includes(one),language+' singular count');
  assert.ok(app.nodes.app.innerHTML.includes(many),language+' plural count');
 }
});
