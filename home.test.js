const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const fn=app.slice(app.indexOf('function todayPlan()'),app.indexOf('function home()'));
function render(plan,weekday){
 const c={window:{},state:{plan},days:[['mon','ПОН'],['tue','ВТО'],['wed','СРЯ'],['thu','ЧЕТ'],['fri','ПЕТ'],['sat','СЪБ'],['sun','НЕД']],cats:{cal:'Калистеника',yoga:'Йога',mobility:'Мобилност'},levels:{beginner:'Начинаещ',intermediate:'Средно',advanced:'Напреднал'},Date:class extends Date{getDay(){return weekday;}},esc:s=>String(s),textFor:(_key,fallback)=>fallback,contentFor:(_kind,item)=>item};
 vm.createContext(c);for(const f of ['exercise-art.js','data.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);c.workouts=c.window.FORME_DATA.workouts;c.byId=(items,id)=>items.find(x=>x.id===id);c.planForDay=day=>c.byId(c.workouts,plan[c.days[(day.getDay()+6)%7][0]]);vm.runInContext(fn+';this.renderToday=todayPlan;',c);return c.renderToday();
}
test('home offers the workout saved for today using the existing plan keys',()=>{
 const html=render({mon:'cal-start'},1);assert.match(html,/Силна основа/);assert.match(html,/data-action="start-workout" data-id="cal-start"/);assert.match(html,/data-page="plan"/);
});
test('rest days and missing workout IDs show an honest empty state',()=>{
 for(const plan of [{sun:''},{sun:'missing'}]){const html=render(plan,0);assert.match(html,/Няма планирана тренировка/);assert.doesNotMatch(html,/data-action="start-workout"/);assert.match(html,/data-page="plan"/);}
});
test('prepared English and German home content renders without changing workout IDs',()=>{
 for(const [language,heading,workout] of [['en','Where would you like to start?','Strong Foundation'],['de','Womit möchtest du beginnen?','Starke Grundlage']]){
  const nodes={},element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
  const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(){}};
  const c={window:{addEventListener(){},scrollTo(){}},document,localStorage:{getItem(key){return key==='forme-language'?language:null;},setItem(){}},location:{hash:'#home'},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
  vm.createContext(c);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
  assert.ok(nodes.app.innerHTML.includes(heading));assert.ok(nodes.app.innerHTML.includes(workout));assert.match(nodes.app.innerHTML,/data-id="cal-start"/);
  assert.match(nodes['desktop-nav'].innerHTML,language==='en'?/My plan/:/Mein Plan/);
 }
});
