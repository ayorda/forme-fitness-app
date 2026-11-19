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
function bootShell(language,hash){
 const nodes={},element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const shellNode={dataset:{i18n:'shell.tagline'},textContent:'ТРЕНИРАЙ · ХРАНИ СЕ · РАСТИ'};
 const document={body:{style:{}},hidden:false,documentElement:{setAttribute(key,value){nodes[key]=value;}},title:'FORME — Тренировки и хранене',querySelectorAll(){return [shellNode];},getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(){}};
 const c={window:{addEventListener(){},scrollTo(){}},document,localStorage:{getItem(key){return key==='forme-language'?language:null;},setItem(){}},location:{hash},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return nodes;
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
  const shellNode={dataset:{i18n:'shell.tagline'},textContent:'ТРЕНИРАЙ · ХРАНИ СЕ · РАСТИ'};
  const document={body:{style:{}},hidden:false,documentElement:{setAttribute(key,value){nodes[key]=value;}},title:'FORME — Тренировки и хранене',querySelectorAll(){return [shellNode];},getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(){}};
  const c={window:{addEventListener(){},scrollTo(){}},document,localStorage:{getItem(key){return key==='forme-language'?language:null;},setItem(){}},location:{hash:'#home'},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
  vm.createContext(c);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
  assert.ok(nodes.app.innerHTML.includes(heading));assert.ok(nodes.app.innerHTML.includes(workout));assert.match(nodes.app.innerHTML,/data-id="cal-start"/);
  assert.match(nodes['desktop-nav'].innerHTML,language==='en'?/My plan/:/Mein Plan/);
  assert.equal(nodes.lang,language);assert.match(shellNode.textContent,language==='en'?/TRAIN · EAT · GROW/:/TRAINIERE · ISS · WACHSE/);
 }
 assert.match(fs.readFileSync('index.html','utf8'),/data-i18n="shell.footer"/);
});
test('mobile navigation has five readable destinations and More highlights secondary pages',()=>{
 for(const [language,more] of [['bg','Още'],['en','More'],['de','Mehr']]){
  const home=bootShell(language,'#home');const mobile=home['mobile-nav'].innerHTML;
  assert.deepEqual([...mobile.matchAll(/data-page="([a-z]+)"/g)].map(m=>m[1]),['home','sessions','nutrition','progress','more']);
  assert.ok(mobile.includes(more));assert.match(mobile,/class="nav-item active" data-action="nav" data-page="home"/);
  assert.equal((home['desktop-nav'].innerHTML.match(/data-page=/g)||[]).length,9,'desktop sidebar keeps every section');
  for(const page of ['recovery','favorites','account','plan','exercises']){
   const nodes=bootShell(language,'#'+page);
   assert.match(nodes['mobile-nav'].innerHTML,/class="nav-item active" data-action="nav" data-page="more" aria-current="page"/,page);
  }
 }
});
test('More page links every secondary section in three languages without leftover keys',()=>{
 for(const language of ['bg','en','de']){
  const html=bootShell(language,'#more').app.innerHTML;
  assert.deepEqual([...html.matchAll(/class="quick-action more-item" data-action="nav" data-page="([a-z]+)"/g)].map(m=>m[1]),['exercises','plan','favorites','recovery','account','services','privacy']);
  assert.doesNotMatch(html,/more\.[a-zA-Z]+|nav\.[a-zA-Z]+/);
 }
});
test('home uses line icons for categories and no longer repeats the hero workout call to action',()=>{
 const html=bootShell('bg','#home').app.innerHTML;
 assert.doesNotMatch(html.split('<section class="home-steps"')[1].split('home-beginner')[0],/💪|🧘/);
 assert.equal((html.match(/class="category-symbol" aria-hidden="true"><svg/g)||[]).length,3);
 assert.equal((html.match(/data-action="nav" data-page="sessions"/g)||[]).length,2,'hero button + “all workouts” link only');
 assert.match(html,/class="quick-action" data-action="nav" data-page="plan"/);
});
