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
