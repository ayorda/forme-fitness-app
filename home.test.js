const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const fn=app.slice(app.indexOf('function todayPlan()'),app.indexOf('function home()'));
function render(plan,weekday){
 const c={window:{},state:{plan},days:[['mon','ПОН'],['tue','ВТО'],['wed','СРЯ'],['thu','ЧЕТ'],['fri','ПЕТ'],['sat','СЪБ'],['sun','НЕД']],cats:{cal:'Калистеника',yoga:'Йога',mobility:'Мобилност'},levels:{beginner:'Начинаещ',intermediate:'Средно',advanced:'Напреднал'},Date:class extends Date{getDay(){return weekday;}},esc:s=>String(s)};
 vm.createContext(c);for(const f of ['exercise-art.js','data.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);c.workouts=c.window.FORME_DATA.workouts;c.byId=(items,id)=>items.find(x=>x.id===id);vm.runInContext(fn+';this.renderToday=todayPlan;',c);return c.renderToday();
}
test('home offers the workout saved for today using the existing plan keys',()=>{
 const html=render({mon:'cal-start'},1);assert.match(html,/Силна основа/);assert.match(html,/data-action="start-workout" data-id="cal-start"/);assert.match(html,/data-page="plan"/);
});
test('rest days and missing workout IDs show an honest empty state',()=>{
 for(const plan of [{sun:''},{sun:'missing'}]){const html=render(plan,0);assert.match(html,/Няма планирана тренировка/);assert.doesNotMatch(html,/data-action="start-workout"/);assert.match(html,/data-page="plan"/);}
});
