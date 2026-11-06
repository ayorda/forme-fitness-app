const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(){
 const handlers={},nodes={},storage={'forme-plan':JSON.stringify({mon:'cal-start'})};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[2024,1,15,12]));}}
 const context={window:{addEventListener(){},scrollTo(){}},document,localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=v;}},location:{hash:'#plan'},Date:Clock,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
 const click=dataset=>handlers.click({target:{closest:()=>({dataset})}});
 return {nodes,storage,click};
}
test('monthly view maps saved weekly workouts onto a leap-year month',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});
 assert.match(a.nodes.app.innerHTML,/февруари 2024/);
 assert.equal((a.nodes.app.innerHTML.match(/data-action="plan-date"/g)||[]).length,29);
 assert.match(a.nodes.app.innerHTML,/data-date="5"[^>]*aria-label="5 февруари 2024 г\.: Силна основа/);
 assert.match(a.nodes.app.innerHTML,/не е запис на изпълнени тренировки/);
 assert.equal(JSON.parse(a.storage['forme-plan']).mon,'cal-start');
});
test('selecting a day offers the scheduled workout and month navigation clears selection',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'5'});
 assert.match(a.nodes.app.innerHTML,/data-action="start-workout" data-id="cal-start"/);
 a.click({action:'start-workout',id:'cal-start'});assert.match(a.nodes['modal-root'].innerHTML,/player-layout/);
 a.click({action:'plan-month',offset:'1'});
 assert.match(a.nodes.app.innerHTML,/март 2024/);assert.doesNotMatch(a.nodes.app.innerHTML,/data-action="start-workout"/);
 a.click({action:'plan-view',view:'week'});assert.match(a.nodes.app.innerHTML,/value="cal-start" selected/);
});
test('rest days are not described as completed workouts and cannot start a workout',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'6'});
 assert.match(a.nodes.app.innerHTML,/Няма планирана тренировка/);
 assert.doesNotMatch(a.nodes.app.innerHTML,/data-action="start-workout"/);
});
