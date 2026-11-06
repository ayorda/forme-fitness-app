const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(blocked){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const storage={getItem(){return null;},setItem(){if(blocked)throw Error('storage unavailable');}};
 const context={window:{addEventListener(){},scrollTo(){}},document,localStorage:storage,location:{hash:'#plan'},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
 return {handlers,nodes};
}
test('failed plan or favorite writes leave a warning instead of a success message',()=>{
 const a=boot(true);a.handlers.change({target:{dataset:{action:'plan-day',day:'mon'},value:'cal-start'}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Plank'}})}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
});
test('successful plan writes still show confirmation',()=>{
 const a=boot(false);a.handlers.change({target:{dataset:{action:'plan-day',day:'mon'},value:'cal-start'}});
 assert.equal(a.nodes.toast.textContent,'Седмичният план е запазен.');
});
