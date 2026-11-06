const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(hash,storage){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}};
 const c={window,document,localStorage,location:{hash},Date:class extends Date{getDay(){return 1;}},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});return {handlers,nodes};
}
test('a workout saved in the weekly plan appears on home after reopening',()=>{
 const storage={};const a=boot('#plan',storage);
 a.handlers.change({target:{dataset:{action:'plan-day',day:'mon'},value:'cal-start'}});
 assert.equal(JSON.parse(storage['forme-plan']).mon,'cal-start');
 assert.match(a.nodes.app.innerHTML,/1 от 7 дни/);
 const b=boot('#home',storage);
 assert.match(b.nodes.app.innerHTML,/Силна основа/);
 assert.match(b.nodes.app.innerHTML,/data-action="start-workout" data-id="cal-start"/);
});
test('existing favorites and saved meals remain readable when the new catalog loads',()=>{
 const storage={'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank']}),'forme-saved-meals':JSON.stringify([{name:'Тест',items:[{id:'rice',grams:150}]}])};
 const a=boot('#favorites',storage);assert.match(a.nodes.app.innerHTML,/Силна основа/);assert.match(a.nodes.app.innerHTML,/Планк/);
 assert.equal(JSON.parse(storage['forme-saved-meals'])[0].name,'Тест');
});
