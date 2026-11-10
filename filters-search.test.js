const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('./core.js');

function loadCatalog(){
 const c={window:{}};
 vm.createContext(c);
 for(const f of ['exercise-art.js','data.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return c.window.FORME_DATA;
}
const D=loadCatalog();

function createApp(page='#sessions'){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const storage={};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}};
 const c={window,document,localStorage,location:{hash:page},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);
 for(const f of ['exercise-art.js','data.js','exercise-photos.js','core.js','food-art.js','food-photos.js','food-translations.js','state-normalizer.js','storage-schema.js','progress.js','programs.js','nutrition-journal.js','backup.js','app.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {handlers,nodes};
}

function selectValues(html,id){
 const match=html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`));
 assert.ok(match,`select #${id} is rendered`);
 return [...match[1].matchAll(/<option value="([^"]*)"/g)].map(m=>m[1]);
}

function foundCount(html){
 const match=html.match(/Намерени (\d+) от (\d+)/);
 assert.ok(match,'expected a results count line: '+html.slice(0,160));
 return {found:Number(match[1]),total:Number(match[2])};
}

function resultIds(html){
 return new Set([...html.matchAll(/data-id="([^"]+)"/g)].map(m=>m[1]));
}

function type(app,group,key,value){
 app.handlers.input({target:{dataset:{filter:group,key},value}});
}

test('every workout filter option offered on the screen matches at least one workout',()=>{
 const html=createApp('#sessions').nodes.app.innerHTML;
 for(const [id,key] of [['workouts-cat','cat'],['workouts-level','level'],['workouts-maxTime','maxTime'],['workouts-equip','equip']]){
  const values=selectValues(html,id);
  assert.ok(values.includes(''),id+' keeps the empty "all" option');
  for(const value of values.filter(Boolean))
   assert.ok(C.filterWorkouts(D.workouts,{[key]:value}).length>=1,`${id}="${value}" must match at least one workout`);
 }
});

test('every exercise and food filter option matches at least one catalog entry',()=>{
 const exercises=createApp('#exercises').nodes.app.innerHTML;
 for(const [id,key] of [['exercises-cat','cat'],['exercises-level','level'],['exercises-equip','equip']]){
  const values=selectValues(exercises,id);
  assert.ok(values.includes(''),id+' keeps the empty "all" option');
  for(const value of values.filter(Boolean))
   assert.ok(C.filterExercises(D.exercises,{[key]:value}).length>=1,`${id}="${value}" must match at least one exercise`);
 }
 const foods=createApp('#nutrition').nodes.app.innerHTML;
 const cats=selectValues(foods,'foods-cat');
 assert.ok(cats.includes(''),'food-cat keeps the empty "all" option');
 for(const value of cats.filter(Boolean))
  assert.ok(D.foods.some(f=>f.cat===value),`food-cat="${value}" must match at least one food`);
});

test('no catalog entry is hidden behind a filter option that its screen does not offer',()=>{
 const sessionOptions=new Set(['cat','level','equip'].flatMap(key=>selectValues(createApp('#sessions').nodes.app.innerHTML,`workouts-${key}`)));
 for(const w of D.workouts){
  assert.ok(sessionOptions.has(w.cat),`${w.id} category "${w.cat}" is offered`);
  assert.ok(sessionOptions.has(w.level),`${w.id} level "${w.level}" is offered`);
  assert.ok(sessionOptions.has(w.equip),`${w.id} equipment "${w.equip}" is offered`);
 }
 const exerciseOptions=new Set(['cat','level','equip'].flatMap(key=>selectValues(createApp('#exercises').nodes.app.innerHTML,`exercises-${key}`)));
 for(const e of D.exercises){
  assert.ok(exerciseOptions.has(e.cat),`${e.id} category "${e.cat}" is offered`);
  assert.ok(exerciseOptions.has(e.level),`${e.id} level "${e.level}" is offered`);
  assert.ok(exerciseOptions.has(e.equip),`${e.id} equipment "${e.equip}" is offered`);
 }
 const foodOptions=new Set(selectValues(createApp('#nutrition').nodes.app.innerHTML,'foods-cat'));
 for(const f of D.foods)assert.ok(foodOptions.has(f.cat),`${f.id} category "${f.cat}" is offered`);
});

test('the four time limits keep their boundary workouts on screen and in data',()=>{
 assert.deepEqual([...C.filterWorkouts(D.workouts,{maxTime:'10'}).map(w=>w.id)],['mob-daily']);
 assert.deepEqual([...C.filterWorkouts(D.workouts,{maxTime:'12'}).map(w=>w.id)].sort(),['cal-start','mob-daily','yoga-reset']);
 assert.equal(C.filterWorkouts(D.workouts,{maxTime:'20'}).length,D.workouts.length);
 assert.equal(C.filterWorkouts(D.workouts,{maxTime:'30'}).length,D.workouts.length);
 const a=createApp('#sessions');
 type(a,'workouts','maxTime','10');
 let results=a.nodes['workout-results'].innerHTML;
 assert.deepEqual([...resultIds(results)].sort(),['mob-daily']);
 assert.equal(foundCount(results).found,1);
 type(a,'workouts','maxTime','12');
 results=a.nodes['workout-results'].innerHTML;
 assert.equal(foundCount(results).found,3);
 assert.ok(resultIds(results).has('cal-start'));
 type(a,'workouts','maxTime','');
 assert.equal(foundCount(a.nodes['workout-results'].innerHTML).found,D.workouts.length);
});

test('the two confirmed filter scenarios from the mobile checklist keep their results',()=>{
 const first=createApp('#sessions');
 type(first,'workouts','cat','cal');
 type(first,'workouts','level','beginner');
 type(first,'workouts','equip','none');
 let results=first.nodes['workout-results'].innerHTML;
 assert.equal(foundCount(results).found,1);
 assert.match(results,/data-id="cal-start"/);
 assert.match(results,/Силна основа/);
 const second=createApp('#sessions');
 type(second,'workouts','cat','yoga');
 type(second,'workouts','level','beginner');
 type(second,'workouts','equip','bar');
 results=second.nodes['workout-results'].innerHTML;
 assert.equal(foundCount(results).found,0);
 assert.match(results,/Няма съвпадения/);
});

test('a time limit combined with a direction narrows the list honestly',()=>{
 const a=createApp('#sessions');
 type(a,'workouts','cat','cal');
 type(a,'workouts','maxTime','10');
 let results=a.nodes['workout-results'].innerHTML;
 assert.equal(foundCount(results).found,0);
 assert.match(results,/Няма съвпадения/);
 type(a,'workouts','maxTime','12');
 results=a.nodes['workout-results'].innerHTML;
 assert.equal(foundCount(results).found,1);
 assert.match(results,/data-id="cal-start"/);
});

test('exercise search stays safe with empty, messy and invalid text',()=>{
 const junk=['','   ','\u200B','.*','+?^${}()|[]{}','\\','<script>alert(1)</script>',"'; DROP TABLE exercises;--",'💥💪','x'.repeat(1000),'null','undefined'];
 for(const q of junk){
  const result=C.filterExercises(D.exercises,{q});
  assert.ok(Array.isArray(result),JSON.stringify(q.slice(0,24)));
  assert.ok(result.length<=D.exercises.length,JSON.stringify(q.slice(0,24)));
 }
 assert.equal(C.filterExercises(D.exercises,{q:''}).length,D.exercises.length);
 assert.equal(C.filterExercises(D.exercises,{q:'   '}).length,D.exercises.length);
 assert.equal(C.filterExercises(D.exercises,{q:'<script>alert(1)</script>'}).length,0);
 assert.equal(C.filterExercises(D.exercises,{q:'💥💪'}).length,0);
 assert.equal(C.filterExercises(D.exercises,{q:'x'.repeat(1000)}).length,0);
 for(const q of ['планк','ПЛАНК','iron cross','IRON CROSS','liegestütze'])
  assert.ok(C.filterExercises(D.exercises,{q}).length>=1,`valid query "${q}" still works after invalid text`);
});

test('the exercise search box survives invalid text and keeps finding movements',()=>{
 const a=createApp('#exercises');
 for(const q of ['','   ','<script>alert(1)</script>','💥','.*','x'.repeat(1000)]){
  type(a,'exercises','q',q);
  const html=a.nodes['exercise-results'].innerHTML;
  assert.match(html,/Намерени \d+ от 49 упражнения/,JSON.stringify(q.slice(0,24)));
  assert.doesNotMatch(html,/undefined|\[object Object\]/,JSON.stringify(q.slice(0,24)));
 }
 type(a,'exercises','q','<script>alert(1)</script>');
 assert.match(a.nodes['exercise-results'].innerHTML,/Няма съвпадения/);
 type(a,'exercises','q','  ПЛАНК  ');
 const html=a.nodes['exercise-results'].innerHTML;
 assert.ok(resultIds(html).has('Plank'),'uppercase search with spaces still finds Планк');
 assert.ok(foundCount(html).found>=1);
});

test('the food search box trims, ignores case and survives invalid text',()=>{
 const a=createApp('#nutrition');
 for(const q of ['💥','<b>bold</b>','.*','x'.repeat(1000)]){
  type(a,'foods','q',q);
  const html=a.nodes['food-results'].innerHTML;
  assert.match(html,/Намерени \d+ от 30 храни/,JSON.stringify(q.slice(0,24)));
  assert.doesNotMatch(html,/undefined|\[object Object\]/,JSON.stringify(q.slice(0,24)));
 }
 type(a,'foods','q','💥');
 assert.match(a.nodes['food-results'].innerHTML,/Няма съвпадения/);
 type(a,'foods','q','  ОРИЗ  ');
 let html=a.nodes['food-results'].innerHTML;
 assert.ok(resultIds(html).has('rice'),'trimmed uppercase search still finds Бял ориз');
 assert.ok(foundCount(html).found>=1);
 type(a,'foods','cat','fruit');
 assert.equal(foundCount(a.nodes['food-results'].innerHTML).found,0,'rice is not a fruit');
 type(a,'foods','cat','carbs');
 html=a.nodes['food-results'].innerHTML;
 assert.ok(resultIds(html).has('rice'));
 assert.equal(foundCount(html).found,2,'Бял ориз и Кафяв ориз');
});

test('search and category filters narrow the exercise results together',()=>{
 const a=createApp('#exercises');
 type(a,'exercises','q','планк');
 type(a,'exercises','cat','cal');
 assert.ok(resultIds(a.nodes['exercise-results'].innerHTML).has('Plank'));
 type(a,'exercises','cat','yoga');
 const html=a.nodes['exercise-results'].innerHTML;
 assert.equal(foundCount(html).found,0);
 assert.match(html,/Няма съвпадения/);
 type(a,'exercises','cat','');
 assert.ok(resultIds(a.nodes['exercise-results'].innerHTML).has('Plank'),'clearing the category restores the match');
});

test('exercise search finds movements by primary muscles in all three languages',()=>{
 const biceps=[...C.filterExercises(D.exercises,{q:'бицепс'}).map(e=>e.id)].sort();
 assert.deepEqual(biceps,['Australian_Rows','Chinups','One_Arm_Pull_Up','Pullups']);
 assert.ok(C.filterExercises(D.exercises,{q:'гръб'}).some(e=>e.id==='Front_Lever'));
 const c={window:{}};
 vm.createContext(c);
 for(const f of ['exercise-art.js','data.js','exercise-translations.js','locale-content.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 const enList=c.window.FORME_DATA.exercises.map(e=>c.window.FORME_LOCALE_CONTENT.translateContent('exercise',e,'en'));
 const deList=c.window.FORME_DATA.exercises.map(e=>c.window.FORME_LOCALE_CONTENT.translateContent('exercise',e,'de'));
 assert.equal(C.filterExercises(enList,{q:'biceps'}).length,4);
 assert.equal(C.filterExercises(deList,{q:'Bizeps'}).length,4);
 assert.ok(C.filterExercises(D.exercises,{q:'прасец'}).some(e=>e.id==='Calf_Stretch_Hands_Against_Wall'));
 assert.ok(C.filterExercises(D.exercises,{q:'side plank'}).some(e=>e.id==='Side_Bridge'));
});

test('food search finds items by preparation state and cross-language names via filterFoods and UI',()=>{
 const cooked=[...C.filterFoods(D.foods,{q:'сварен'}).map(f=>f.id)].sort();
 assert.deepEqual(cooked,['brownrice','lentils','quinoa','rice']);
 assert.deepEqual([...C.filterFoods(D.foods,{q:'нискомаслен'}).map(f=>f.id)].sort(),['cottage','greek']);
 const a=createApp('#nutrition');
 type(a,'foods','q','cooked');
 assert.ok(resultIds(a.nodes['food-results'].innerHTML).has('rice'));
 type(a,'foods','q','Haferflocken');
 assert.ok(resultIds(a.nodes['food-results'].innerHTML).has('oats'));
});

test('reset-filters restores all items when a filter combination yields no matches',()=>{
 const w=createApp('#sessions');
 type(w,'workouts','cat','yoga');
 type(w,'workouts','equip','bar');
 assert.equal(foundCount(w.nodes['workout-results'].innerHTML).found,0);
 assert.match(w.nodes['workout-results'].innerHTML,/data-action="reset-filters"/);
 w.handlers.click({target:{closest:()=>({dataset:{action:'reset-filters',group:'workouts'}})}});
 assert.equal(foundCount(w.nodes['workout-results'].innerHTML).found,D.workouts.length);

 const ex=createApp('#exercises');
 type(ex,'exercises','q','zzzz');
 assert.equal(foundCount(ex.nodes['exercise-results'].innerHTML).found,0);
 ex.handlers.click({target:{closest:()=>({dataset:{action:'reset-filters',group:'exercises'}})}});
 assert.equal(foundCount(ex.nodes['exercise-results'].innerHTML).found,D.exercises.length);

 const fd=createApp('#nutrition');
 type(fd,'foods','q','zzzz');
 assert.equal(foundCount(fd.nodes['food-results'].innerHTML).found,0);
 fd.handlers.click({target:{closest:()=>({dataset:{action:'reset-filters',group:'foods'}})}});
 assert.equal(foundCount(fd.nodes['food-results'].innerHTML).found,D.foods.length);
});
