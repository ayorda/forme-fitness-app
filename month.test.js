const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(saved={},blocked=false,translated=false){
 const handlers={},nodes={},storage={'forme-plan':JSON.stringify({mon:'cal-start'}),...saved};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 let now=new Date(2024,1,15,12);class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}}
 const context={window:{addEventListener(type,fn){handlers['window:'+type]=fn;},scrollTo(){}},document,localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>{if(blocked)throw Error('blocked');storage[k]=v;}},location:{hash:'#plan'},Date:Clock,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 const files=['exercise-art.js','data.js','core.js','food-art.js'];if(translated)files.push('i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js');files.push('app.js');
 vm.createContext(context);for(const f of files)vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
 const click=dataset=>handlers.click({target:{closest:()=>({dataset})}});
 return {nodes,storage,click,handlers,advanceDay(){now=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,12);}};
}
test('monthly view maps saved weekly workouts onto a leap-year month',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});
 assert.match(a.nodes.app.innerHTML,/февруари 2024/);
 assert.equal((a.nodes.app.innerHTML.match(/data-action="plan-date"/g)||[]).length,29);
 assert.match(a.nodes.app.innerHTML,/data-date="5"[^>]*aria-label="5 Калистеника · февруари 2024 г\.: Силна основа/);
 assert.match(a.nodes.app.innerHTML,/Само тренировките, които сам отбележиш/);
 assert.equal(JSON.parse(a.storage['forme-plan']).mon,'cal-start');
});
test('monthly calendar translates saved workout IDs and completion names',()=>{
 for(const [language,month,workout] of [['en','February 2024','Strong Foundation'],['de','Februar 2024','Starke Grundlage']]){
  const a=boot({'forme-language':language,'forme-completed-workouts':JSON.stringify({'2024-02-05':{id:'cal-start',name:'Силна основа'}})},false,true);
  a.click({action:'plan-view',view:'month'});
  assert.ok(a.nodes.app.innerHTML.includes(month));assert.match(a.nodes.app.innerHTML,new RegExp('data-date="5"[^>]*'+workout));
  a.click({action:'plan-date',date:'5'});
  assert.ok(a.nodes.app.innerHTML.includes(workout));assert.doesNotMatch(a.nodes.app.innerHTML,/Отбелязана като изпълнена: Силна основа/);
  assert.equal(JSON.parse(a.storage['forme-completed-workouts'])['2024-02-05'].id,'cal-start');
 }
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
test('manual completion persists for the selected date and can be removed',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'5'});
 assert.match(a.nodes.app.innerHTML,/Отбележи като изпълнена/);
 a.click({action:'completion-add'});assert.equal(JSON.parse(a.storage['forme-completed-workouts'])['2024-02-05'].id,'cal-start');
 assert.match(a.nodes.app.innerHTML,/Отбелязана като изпълнена: Силна основа/);
 const b=boot(a.storage);b.click({action:'plan-view',view:'month'});b.click({action:'plan-date',date:'5'});
 assert.match(b.nodes.app.innerHTML,/Отбелязана като изпълнена: Силна основа/);
 b.click({action:'completion-remove'});assert.deepEqual(JSON.parse(b.storage['forme-completed-workouts']),{});
});
test('future and rest days cannot be marked completed',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'19'});
 assert.doesNotMatch(a.nodes.app.innerHTML,/data-action="completion-add"/);a.click({action:'completion-add'});
 a.click({action:'plan-date',date:'6'});assert.doesNotMatch(a.nodes.app.innerHTML,/data-action="completion-add"/);a.click({action:'completion-add'});
 assert.equal(a.storage['forme-completed-workouts'],undefined);
});
test('a recorded workout remains identifiable when the weekly plan changes',()=>{
 const a=boot({'forme-plan':JSON.stringify({}), 'forme-completed-workouts':JSON.stringify({'2024-02-05':{id:'cal-start',name:'Силна основа'}})});
 a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'5'});
 assert.match(a.nodes.app.innerHTML,/Няма планирана тренировка/);
 assert.match(a.nodes.app.innerHTML,/Отбелязана като изпълнена: Силна основа/);
 assert.match(a.nodes.app.innerHTML,/Премахни отметката/);
});
test('failed storage keeps the warning and does not claim completion',()=>{
 const a=boot({},true);a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'5'});a.click({action:'completion-add'});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
 assert.doesNotMatch(a.nodes.app.innerHTML,/Отбелязана като изпълнена:/);
});
test('a date-specific rest day persists without altering other Mondays or the weekly plan',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'5'});
 a.nodes['date-plan-select']={value:'rest'};a.click({action:'save-date-plan'});
 assert.equal(JSON.parse(a.storage['forme-date-plans'])['2024-02-05'],'');
 assert.equal(JSON.parse(a.storage['forme-plan']).mon,'cal-start');
 assert.match(a.nodes.app.innerHTML,/Няма планирана тренировка/);
 a.click({action:'plan-date',date:'12'});assert.match(a.nodes.app.innerHTML,/data-action="start-workout" data-id="cal-start"/);
 const b=boot(a.storage);b.click({action:'plan-view',view:'month'});b.click({action:'plan-date',date:'5'});
 assert.match(b.nodes.app.innerHTML,/Избор само за тази дата/);assert.doesNotMatch(b.nodes.app.innerHTML,/data-action="start-workout"/);
 b.nodes['date-plan-select']={value:'weekly'};b.click({action:'save-date-plan'});
 assert.deepEqual(JSON.parse(b.storage['forme-date-plans']),{});assert.match(b.nodes.app.innerHTML,/data-action="start-workout" data-id="cal-start"/);
});
test('today on the home screen respects a date-specific rest day',()=>{
 const a=boot({'forme-plan':JSON.stringify({thu:'cal-start'}),'forme-date-plans':JSON.stringify({'2024-02-15':''})});
 a.click({action:'nav',page:'home'});a.handlers['window:hashchange']();
 assert.match(a.nodes.app.innerHTML,/Няма планирана тренировка/);
 const today=a.nodes.app.innerHTML.split('<section class="home-steps"')[0];assert.doesNotMatch(today,/data-action="start-workout"/);
});
test('date-specific workouts can be completed and a failed save leaves the old plan unchanged',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'5'});
 a.nodes['date-plan-select']={value:'workout:yoga-reset'};a.click({action:'save-date-plan'});a.click({action:'completion-add'});
 assert.equal(JSON.parse(a.storage['forme-completed-workouts'])['2024-02-05'].id,'yoga-reset');
 const b=boot({},true);b.click({action:'plan-view',view:'month'});b.click({action:'plan-date',date:'5'});b.nodes['date-plan-select']={value:'rest'};b.click({action:'save-date-plan'});
 assert.match(b.nodes.toast.textContent,/Неуспешно локално запазване/);assert.match(b.nodes.app.innerHTML,/data-action="start-workout" data-id="cal-start"/);
});
test('today highlighting updates when the app becomes visible after midnight',()=>{
 const a=boot();a.click({action:'plan-view',view:'month'});
 assert.match(a.nodes.app.innerHTML,/id="month-date-15" class="month-day month-day-today/);
 a.advanceDay();a.handlers.visibilitychange();
 assert.match(a.nodes.app.innerHTML,/id="month-date-16" class="month-day month-day-today/);
 assert.doesNotMatch(a.nodes.app.innerHTML,/id="month-date-15" class="month-day month-day-today/);
});
test('clearing the weekly plan leaves individual dates and completion records intact',()=>{
 const a=boot({'forme-date-plans':JSON.stringify({'2024-02-05':'yoga-reset'}),'forme-completed-workouts':JSON.stringify({'2024-02-05':{id:'yoga-reset',name:'Спокойно възстановяване'}})});
 a.click({action:'clear-plan'});
 assert.deepEqual(JSON.parse(a.storage['forme-plan']),{});
 assert.equal(JSON.parse(a.storage['forme-date-plans'])['2024-02-05'],'yoga-reset');
 assert.equal(JSON.parse(a.storage['forme-completed-workouts'])['2024-02-05'].id,'yoga-reset');
 a.click({action:'plan-view',view:'month'});a.click({action:'plan-date',date:'5'});
 assert.match(a.nodes.app.innerHTML,/Отбелязана като изпълнена: Спокойно възстановяване/);
});
