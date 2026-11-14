const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(hash,storage={},startNow=null,withI18n=false){
 const handlers={},nodes={};
 let now=startNow;
 class Clock extends Date{constructor(...args){super(...(args.length?args:now?[now]:[]));}}
 const element=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,activeElement:{isConnected:true,focus(){}},getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;},removeItem:key=>{delete storage[key];}};
 const context={window,document,localStorage,location:{hash},Date:startNow?Clock:Date,setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);
 const files=['exercise-art.js','data.js','core.js','food-art.js'];
 if(withI18n)files.push('i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js');
 files.push('state-normalizer.js','storage-schema.js','progress.js','programs.js','nutrition-journal.js','backup.js','app.js');
 for(const file of files)
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 const page=()=>nodes.app.innerHTML;
 return {
  page,
  window,
  node:id=>document.getElementById(id),
  toast:()=>nodes.toast.textContent,
  storage,
  click:target=>handlers.click({target:{closest:()=>target}}),
  change:target=>handlers.change({target}),
  input:target=>handlers.input({target}),
  keydown:event=>handlers.keydown(event),
  visibilitychange:()=>handlers.visibilitychange(),
  advanceDay(){if(now)now=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,12);}
 };
}

const corrupted={
 'forme-favorites':'{"workouts":5,"exercises":null}',
 'forme-current-meal':'{"a":1}',
 'forme-saved-meals':'[{"name":5}]',
 'forme-plan':'"junk"',
 'forme-date-plans':'null',
 'forme-completed-workouts':'[]',
 'forme-sound':'"yes"',
 'forme-user-v1':'[]',
 'forme-progress-v1':'{"version":1,"goal":"bad","sessions":[null,{"id":"x","workoutId":"cal-start","date":"2026-11-08","minutes":"<img onerror=1>"}],"sets":[null]}',
 'forme-nutrition-v1':'{"version":1,"goal":{"kcal":0,"protein":-5},"entries":[{"id":"a","date":"2026-11-08","name":{"x":1},"items":[null]}]}'
};

test('corrupted local data is repaired before every screen renders',()=>{
 for(const page of ['#home','#sessions','#exercises','#nutrition','#plan','#progress','#favorites']){
  const app=boot(page,{...corrupted});
  assert.ok(app.page().length>200,page);
  assert.doesNotMatch(app.page(),/\[object Object\]/,page);
 }
 const meal=boot('#nutrition',{...corrupted});
 meal.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(meal.page(),/Празна чиния/);
 meal.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(meal.page(),/Все още няма запазени хранения/);
});

test('favorites, plans and meals keep only entries that still exist in the catalog',()=>{
 const app=boot('#favorites',{
  'forme-favorites':JSON.stringify({exercises:['Plank','removed-exercise','Plank'],workouts:['cal-start','removed-workout']}),
  'forme-plan':JSON.stringify({mon:'cal-start',tue:'removed-workout',wed:7}),
  'forme-current-meal':JSON.stringify([{id:'rice',grams:'150'},{id:'removed-food',grams:'100'},{id:'egg',grams:'0'}])
 });
 assert.match(app.page(),/Планк/);assert.match(app.page(),/Силна основа/);
 assert.doesNotMatch(app.page(),/removed-workout|removed-exercise/);
 const meal=boot('#nutrition',{'forme-current-meal':JSON.stringify([{id:'rice',grams:'150'},{id:'removed-food',grams:'100'}])});
 meal.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.equal((meal.page().match(/class="meal-row"/g)||[]).length,1);
 assert.doesNotMatch(meal.page(),/removed-food/);
});

test('a cleared journal date keeps the last valid day instead of summing the history',()=>{
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[
  {id:'a',date:'2026-11-01',name:'Едно',items:[{id:'rice',grams:'100'}]},
  {id:'b',date:'2026-11-02',name:'Две',items:[{id:'rice',grams:'100'}]}
 ]})});
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/0 \/ 2000 kcal/);
 const date=app.node('journal-date');
 date.value='';
 app.change({id:'journal-date',value:'',dataset:{}});
 assert.match(app.toast(),/Избери валидна дата/);
 assert.match(app.page(),/0 \/ 2000 kcal/);
 assert.doesNotMatch(app.page(),/260 \/ 2000 kcal/);
 date.value='2026-11-01';
 app.change({id:'journal-date',value:'2026-11-01',dataset:{}});
 assert.match(app.page(),/130 \/ 2000 kcal/);
 assert.equal((app.page().match(/journal-entry/g)||[]).length,1);
});

test('a meal cannot be added to the journal without a valid date',()=>{
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[]})});
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 app.click({dataset:{action:'add-selected-food'}});
 app.node('meal-date').value='';
 app.click({dataset:{action:'journal-save'}});
 assert.match(app.toast(),/Избери валидна дата/);
 assert.equal(JSON.parse(app.storage['forme-nutrition-v1']).entries.length,0);
});

test('a saved meal can be edited in place instead of being saved twice',()=>{
 const meals=[{name:'Обяд',items:[{id:'rice',grams:'150'}]},{name:'Вечеря',items:[{id:'egg',grams:'100'}]}];
 const app=boot('#nutrition',{'forme-saved-meals':JSON.stringify(meals)});
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.equal((app.page().match(/data-action="edit-saved-meal"/g)||[]).length,2);
 app.click({dataset:{action:'edit-saved-meal',index:'0'}});
 assert.match(app.page(),/meal-edit-note/);
 assert.match(app.page(),/Обнови запазеното хранене/);
 const grams=app.node('meal-grams-0');grams.value='250';
 app.input({dataset:{action:'meal-grams',index:'0'},value:'250',classList:{toggle(){}}});
 app.click({dataset:{action:'save-meal'}});
 const saved=JSON.parse(app.storage['forme-saved-meals']);
 assert.equal(saved.length,2);
 assert.equal(saved[0].name,'Обяд');assert.equal(saved[0].items[0].grams,'250');
 assert.equal(saved[1].name,'Вечеря');
 assert.match(app.toast(),/обновено/);
});

test('cancelling a saved meal edit returns to the list without touching the data',()=>{
 const meals=[{name:'Обяд',items:[{id:'rice',grams:'150'}]}];
 const app=boot('#nutrition',{'forme-saved-meals':JSON.stringify(meals),'forme-current-meal':JSON.stringify([{id:'egg',grams:'100'}])});
 app.click({dataset:{action:'edit-saved-meal',index:'0'}});
 app.click({dataset:{action:'cancel-saved-edit'}});
 assert.equal(JSON.parse(app.storage['forme-saved-meals'])[0].name,'Обяд');
 assert.doesNotMatch(app.page(),/meal-edit-note/);
 assert.match(app.page(),/data-action="load-meal"/);
});

test('adding a program opens the month calendar where its dates are visible',()=>{
 const app=boot('#progress',{});
 app.click({dataset:{action:'program-activate',id:'foundation'}});
 assert.equal(Object.keys(JSON.parse(app.storage['forme-date-plans'])).length,12);
 assert.match(app.page(),/month-grid/);
 assert.ok((app.page().match(/data-action="plan-date"/g)||[]).length>=28);
});

test('navigation renders the destination page without waiting for a hash event',()=>{
 const app=boot('#home',{});
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/progress-stats/);
 app.click({dataset:{action:'nav',page:'unknown-page'}});
 assert.match(app.page(),/hero home-hero/);
});

test('a food card without a downloaded photo keeps an accessible local fallback',()=>{
 const app=boot('#nutrition',{});
 const results=app.node('food-results').innerHTML;
 assert.match(results,/food-media-placeholder" role="img"/);
 assert.match(results,/Снимката не е изтеглена/);
 assert.doesNotMatch(results,/aria-label="Снимката не е изтеглена: "/);
});

test('removing a meal row keeps focus on the next amount field',()=>{
 const app=boot('#nutrition',{'forme-current-meal':JSON.stringify([{id:'rice',grams:'100'},{id:'egg',grams:'50'}])});
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 let focused=false;
 app.node('meal-grams-0').focus=()=>{focused=true;};
 app.click({dataset:{action:'remove-meal',index:'0'}});
 assert.equal(focused,true);
 assert.equal(JSON.parse(app.storage['forme-current-meal']).length,1);
});

test('the player names the exercise that just finished and announces phase changes',()=>{
 const app=boot('#sessions',{});
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 const announcer=app.node('player-announcer');
 assert.match(announcer.textContent,/ГОТОВ ЛИ СИ\?/);
 app.click({dataset:{action:'player-start'}});
 assert.match(announcer.textContent,/^Работа: /);
 app.click({dataset:{action:'player-next'}});
 assert.match(announcer.textContent,/^Почивка\. Следва: /);
 assert.match(app.node('player-layout').innerHTML,/player-rest-name/);
 assert.match(app.node('player-layout').innerHTML,/Изпълни: /);
 assert.doesNotMatch(app.node('player-layout').innerHTML,/undefined/);
});

test('editing a saved meal preserves its name when adding or removing ingredients',()=>{
 const meals=[{name:'Обяд',items:[{id:'rice',grams:'150'}]}];
 const app=boot('#nutrition',{'forme-saved-meals':JSON.stringify(meals)});
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 app.click({dataset:{action:'edit-saved-meal',index:'0'}});
 assert.equal(app.node('meal-name').value,'Обяд');
 app.node('meal-food-select').value='chicken';
 app.click({dataset:{action:'add-selected-food'}});
 assert.equal(app.node('meal-name').value,'Обяд');
 app.click({dataset:{action:'save-meal'}});
 const saved=JSON.parse(app.storage['forme-saved-meals']);
 assert.equal(saved.length,1);
 assert.equal(saved[0].name,'Обяд');
 assert.equal(saved[0].items.length,2);
});

test('editing a journal entry shows an edit banner, keeps its name and date across ingredient edits, and supports cancel',()=>{
 const date='2026-11-05';
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({
  version:1,goal:{kcal:2000,protein:100},
  entries:[{id:'j1',date,name:'Закуска',items:[{id:'oats',grams:'80'}]}]
 })});
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 app.change({id:'journal-date',value:date,dataset:{}});
 app.click({dataset:{action:'journal-edit',id:'j1'}});
 assert.match(app.page(),/meal-edit-note/);
 assert.match(app.page(),/data-action="cancel-journal-edit"/);
 assert.equal(app.node('meal-name').value,'Закуска');
 assert.equal(app.node('meal-date').value,date);
 app.node('meal-food-select').value='banana';
 app.click({dataset:{action:'add-selected-food'}});
 assert.equal(app.node('meal-name').value,'Закуска');
 assert.equal(app.node('meal-date').value,date);
 app.click({dataset:{action:'journal-save'}});
 const updated=JSON.parse(app.storage['forme-nutrition-v1']).entries;
 assert.equal(updated.length,1);
 assert.equal(updated[0].name,'Закуска');
 assert.equal(updated[0].date,date);
 assert.equal(updated[0].items.length,2);
 app.click({dataset:{action:'journal-edit',id:'j1'}});
 app.click({dataset:{action:'cancel-journal-edit'}});
 assert.doesNotMatch(app.page(),/meal-edit-note/);
 app.click({dataset:{action:'journal-build'}});
 assert.equal(app.node('meal-date').value,date);
});

test('saved meals, journal entries and progress history give each action button a specific accessible label',()=>{
 const date='2026-11-08';
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([{name:'Вечеря',items:[{id:'salmon',grams:'150'}]}]),
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'j1',date,name:'Обяд',items:[{id:'rice',grams:'150'}]}]}),
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'p1',workoutId:'cal-start',date,minutes:12}],sets:[]})
 });
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/aria-label="Зареди: Вечеря"/);
 assert.match(app.page(),/aria-label="Редактирай: Вечеря"/);
 assert.match(app.page(),/aria-label="Изтрий хранене: Вечеря"/);
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 app.change({id:'journal-date',value:date,dataset:{}});
 assert.match(app.page(),/aria-label="Редактирай: Обяд"/);
 assert.match(app.page(),/aria-label="Изтрий запис: Обяд"/);
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/aria-label="Премахни запис: Силна основа"/);
});

test('clear-meal empties the plate, resets edit state, and persists an empty current meal',()=>{
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([{name:'Обяд',items:[{id:'rice',grams:'150'},{id:'chicken',grams:'200'}]}])
 });
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 app.click({dataset:{action:'edit-saved-meal',index:'0'}});
 assert.match(app.page(),/data-action="clear-meal"/);
 app.click({dataset:{action:'clear-meal'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[]);
 assert.doesNotMatch(app.page(),/data-action="clear-meal"/);
 assert.doesNotMatch(app.page(),/meal-edit-note/);
 assert.match(app.page(),/Празна чиния/);
});

test('nutrition tabs expose WAI-ARIA tablist state and support keyboard navigation',()=>{
 const app=boot('#nutrition');
 assert.match(app.page(),/role="tablist"/);
 assert.match(app.page(),/id="food-tab-library"[^>]*role="tab"[^>]*aria-selected="true"/);
 assert.match(app.page(),/id="food-tab-meal"[^>]*role="tab"[^>]*aria-selected="false"/);
 assert.match(app.page(),/id="food-tab-content" role="tabpanel" aria-labelledby="food-tab-library"/);
 const key=(tab,k)=>app.keydown({key:k,preventDefault(){},target:{closest:()=>({dataset:{action:'food-tab',tab}})}});
 key('library','ArrowRight');
 assert.match(app.page(),/id="food-tab-meal"[^>]*role="tab"[^>]*aria-selected="true"/);
 assert.match(app.page(),/aria-labelledby="food-tab-meal"/);
 key('meal','End');
 assert.match(app.page(),/id="food-tab-journal"[^>]*role="tab"[^>]*aria-selected="true"/);
 key('journal','Home');
 assert.match(app.page(),/id="food-tab-library"[^>]*role="tab"[^>]*aria-selected="true"/);
});

test('four-week program cards list their included workout names on Progress',()=>{
 const app=boot('#progress');
 assert.match(app.page(),/Силна основа/);
 assert.match(app.page(),/Контрол и сила/);
 assert.match(app.page(),/Свободни стави/);
});

test('top-favorites button reflects saved favorites and active page state',()=>{
 const attrs={};
 const app=boot('#home');
 const topFav=app.node('top-favorites');
 topFav.setAttribute=(k,v)=>{attrs[k]=v;};
 topFav.removeAttribute=k=>{delete attrs[k];};
 assert.equal(topFav.textContent,'♡');
 app.click({dataset:{action:'favorite',kind:'workouts',id:'cal-start'}});
 assert.equal(topFav.textContent,'♥');
 app.click({dataset:{action:'nav',page:'favorites'}});
 assert.equal(attrs['aria-current'],'page');
 app.click({dataset:{action:'nav',page:'home'}});
 assert.equal(attrs['aria-current'],undefined);
});

test('activating a 4-week program near month-end jumps to the first scheduled workout month and selects its first day',()=>{
 const app=boot('#progress',{},new Date(2024,1,28,12));
 app.click({dataset:{action:'program-activate',id:'foundation'}});
 assert.match(app.page(),/март 2024/);
 assert.match(app.page(),/class="tag">4 март 2024/);
 assert.match(app.page(),/Силна основа/);
});

test('midnight rollover advances default nutrition dates and refreshes Nutrition and Progress screens',()=>{
 const app=boot('#nutrition',{},new Date(2024,1,28,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2024-02-28"/);
 app.advanceDay();
 app.visibilitychange();
 assert.match(app.page(),/id="journal-date" type="date" value="2024-02-29"/);
});

test('log-saved-meal adds a saved meal directly to the nutrition journal without overwriting the draft plate',()=>{
 const app=boot('#nutrition',{
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'200'}]),
  'forme-saved-meals':JSON.stringify([{name:'Овесена закуска',items:[{id:'oats',grams:'80'},{id:'banana',grams:'100'}]}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/data-action="log-saved-meal" data-index="0"/);
 app.click({dataset:{action:'log-saved-meal',index:'0'}});
 assert.equal(app.toast(),'Записът е запазен.');
 assert.match(app.page(),/Овесена закуска/);
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'200'}]);
});

test('nutrition journal displays fiber and switches dates via day stepper and 7-day chart bars',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'e1',date:'2026-11-08',name:'Обяд',items:[{id:'lentils',grams:'200'}]}]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/Фибри: 0 г/);
 app.click({dataset:{action:'journal-step-date',offset:'-1'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-08"/);
 assert.match(app.page(),/Обяд/);
 assert.match(app.page(),/Фибри: 15,8 г/);
 app.click({dataset:{action:'journal-pick-date',date:'2026-11-09'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-09"/);
});

test('exercise details display personal best from logged sets',()=>{
 const storage={
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[],
   sets:[
    {id:'s1',exerciseId:'Plank',date:'2026-11-08',kind:'seconds',value:35},
    {id:'s2',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:55}
   ]
  })
 };
 const app=boot('#exercises',storage);
 app.click({dataset:{action:'exercise-detail',id:'Plank'}});
 assert.match(app.node('modal-root').innerHTML,/Личен рекорд: 55 секунди/);
});

test('food details quick portion presets update grams and recalculate nutrition before adding to meal',()=>{
 const app=boot('#nutrition');
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="detail-preset-grams" data-id="chicken" data-grams="200"/);
 app.click({dataset:{action:'detail-preset-grams',id:'chicken',grams:'200'}});
 assert.equal(app.node('detail-grams').value,'200');
 assert.match(app.node('detail-table').innerHTML,/240 kcal/);
 app.click({dataset:{action:'detail-add-food',id:'chicken'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'200'}]);
 assert.match(app.page(),/240 <span>kcal<\/span>/);
});

test('journal-today button jumps back to the current date when viewing an earlier day',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.doesNotMatch(app.page(),/data-action="journal-today"/);
 app.click({dataset:{action:'journal-step-date',offset:'-1'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-08"/);
 assert.match(app.page(),/data-action="journal-today"/);
 app.click({dataset:{action:'journal-today'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-09"/);
});

test('manual workout logging on Progress auto-fills duration, records minutes and syncs Home overview',()=>{
 const app=boot('#progress',{},new Date(2026,10,9,12));
 app.change({id:'log-workout-id',value:'yoga-flow',dataset:{}});
 assert.equal(app.node('log-workout-minutes').value,'20');
 app.node('log-workout-id').value='yoga-flow';
 app.node('log-workout-date').value='2026-11-09';
 app.click({dataset:{action:'progress-workout'}});
 assert.equal(app.toast(),'Тренировката е записана в дневника.');
 assert.match(app.page(),/<strong>20 \/ 90<\/strong>/);
 app.click({dataset:{action:'nav',page:'home'}});
 assert.match(app.page(),/<strong>1 \/ 3<\/strong> · <strong>20 \/ 90 мин<\/strong>/);
 assert.match(app.page(),/Отбелязана като изпълнена: Дълбоко разтягане/);
});

test('home overview surfaces both weekly minutes goal and daily protein goal',()=>{
 const app=boot('#home',{
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2200,protein:130},
   entries:[{id:'e1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'}]}]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/240 \/ 2\s*200 kcal/);
 assert.match(app.page(),/Протеин: <strong>45 \/ 130 г<\/strong>/);
});

test('journal-copy-today duplicates an earlier meal entry directly into today',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'e-prev',date:'2026-11-08',name:'Вечеря',items:[{id:'salmon',grams:'150'}]}]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 app.click({dataset:{action:'journal-step-date',offset:'-1'}});
 assert.match(app.page(),/data-action="journal-copy-today" data-id="e-prev"/);
 app.click({dataset:{action:'journal-copy-today',id:'e-prev'}});
 assert.equal(app.toast(),'Записът е запазен.');
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-09"/);
 assert.match(app.page(),/Вечеря/);
});

test('saved meals tab shows count badge and food detail highlights active portion preset',()=>{
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([
   {name:'Закуска',items:[{id:'oats',grams:'80'}]},
   {name:'Обяд',items:[{id:'chicken',grams:'200'}]}
  ])
 });
 assert.match(app.page(),/Запазени хранения \(2\)/);
 app.click({dataset:{action:'food-detail',id:'avocado'}});
 assert.match(app.node('modal-root').innerHTML,/role="dialog" aria-modal="true" aria-label="Авокадо"/);
 assert.match(app.node('modal-root').innerHTML,/data-grams="100" aria-pressed="true"/);
 app.click({dataset:{action:'detail-preset-grams',id:'avocado',grams:'150'}});
 assert.match(app.node('detail-presets').innerHTML,/data-grams="150" aria-pressed="true"/);
 assert.match(app.node('detail-presets').innerHTML,/data-grams="100" aria-pressed="false"/);
});

test('empty favorites and saved meals screens offer 1-tap navigation actions',()=>{
 const favApp=boot('#favorites');
 assert.match(favApp.page(),/data-action="nav" data-page="sessions"/);
 assert.match(favApp.page(),/data-action="nav" data-page="exercises"/);
 favApp.click({dataset:{action:'nav',page:'exercises'}});
 assert.match(favApp.page(),/id="ex-search"/);

 const nutApp=boot('#nutrition');
 nutApp.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(nutApp.page(),/data-action="go-meal"/);
 nutApp.click({dataset:{action:'go-meal'}});
 assert.match(nutApp.page(),/id="meal-food-select"/);
});

test('four-week program workout chips open workout preview modal and 4-week chart shows active minutes',()=>{
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:18}],
   sets:[]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/1 тренировки · 18 мин/);
 assert.match(app.page(),/<small>18 мин<\/small>/);
 assert.match(app.page(),/program-card[\s\S]*data-action="workout-detail" data-id="cal-start"/);
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 assert.match(app.node('modal-root').innerHTML,/<h2>Силна основа<\/h2>/);
});

test('progress set logging supports custom dates and personal best shows record date',()=>{
 const app=boot('#progress',{},new Date(2026,10,9,12));
 assert.match(app.page(),/id="set-date" type="date" value="2026-11-09"/);
 app.node('set-exercise').value='Plank';
 app.node('set-date').value='2026-11-07';
 app.node('set-kind').value='seconds';
 app.node('set-value').value='65';
 app.click({dataset:{action:'progress-set'}});
 assert.equal(app.toast(),'Серията е записана.');
 assert.match(app.page(),/2026-11-07 · 65 секунди/);
 app.click({dataset:{action:'nav',page:'exercises'}});
 app.click({dataset:{action:'exercise-detail',id:'Plank'}});
 assert.match(app.node('modal-root').innerHTML,/Личен рекорд: 65 секунди · 2026-11-07/);
});

test('saved meals preview protein total and localized ingredient breakdown',()=>{
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([{name:'След тренировка',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}])
 });
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/протеин/i);
 assert.match(app.page(),/saved-ingredients[\s\S]*\(200 г\)[\s\S]*\(150 г\)/);
});

test('progress and nutrition journal display visual goal meters and live backup record summary',()=>{
 const app=boot('#progress',{
  'forme-favorites':JSON.stringify({exercises:['Plank'],workouts:['cal-start']}),
  'forme-saved-meals':JSON.stringify([{name:'Закуска',items:[{id:'oats',grams:'80'}]}]),
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:4,minutesPerWeek:100},sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:25}],sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:45}]}),
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'e1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'}]}]})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/progress goal-meter[\s\S]*width:25%/);
 assert.match(app.page(),/backup-summary[\s\S]*1 тренировки[\s\S]*1 · Серии[\s\S]*1 · Дневник[\s\S]*1 · Запазени хранения[\s\S]*2 · Любими/);
 app.click({dataset:{action:'nav',page:'nutrition'}});
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/progress goal-meter[\s\S]*width:12%/);
});

test('progress journal filters between all, workouts and sets and opens item details',()=>{
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:15}],
   sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-08',kind:'seconds',value:50}]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="progress-filter" data-view="all" aria-pressed="true"/);
 app.click({dataset:{action:'progress-filter',view:'set'}});
 assert.match(app.page(),/data-action="progress-filter" data-view="set" aria-pressed="true"/);
 assert.match(app.page(),/2026-11-08 · 50 секунди/);
 assert.doesNotMatch(app.page(),/2026-11-09 · 15 мин/);
 app.click({dataset:{action:'exercise-detail',id:'Plank'}});
 assert.match(app.node('modal-root').innerHTML,/<h2>Планк<\/h2>/);
});

test('exercise cards in catalog and favorites display personal best badge',()=>{
 const app=boot('#favorites',{
  'forme-favorites':JSON.stringify({exercises:['Plank'],workouts:[]}),
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[],
   sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:70}]
  })
 });
 assert.match(app.page(),/★ 70 секунди/);
});

test('nutrition journal saves entry to saved meals in 1 tap and meal rows open food details',()=>{
 const app=boot('#nutrition',{
  'forme-current-meal':JSON.stringify([{id:'avocado',grams:'100'}]),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'e1',date:'2026-11-09',name:'Обяд с ориз',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 app.click({dataset:{action:'journal-save-meal',id:'e1'}});
 assert.equal(app.toast(),'Храненето е запазено.');
 assert.match(app.page(),/Запазени хранения \(1\)/);
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/class="link-btn" data-action="food-detail" data-id="avocado"/);
 app.click({dataset:{action:'food-detail',id:'avocado'}});
 assert.match(app.node('modal-root').innerHTML,/<h2>Авокадо<\/h2>/);
});

test('home today card opens workout preview modal and renders visual goal meters',()=>{
 const app=boot('#home',{
  'forme-weekly-plan':JSON.stringify({mon:'cal-start'}),
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:4,minutesPerWeek:120},
   sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:12}],
   sets:[]
  }),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'e1',date:'2026-11-09',name:'Закуска',items:[{id:'banana',grams:'200'}]}]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/today-plan-actions[\s\S]*data-action="workout-detail" data-id="cal-start"/);
 assert.match(app.page(),/home-meters[\s\S]*width:25%[\s\S]*width:9%/);
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 assert.match(app.node('modal-root').innerHTML,/<h2>Силна основа<\/h2>/);
});

test('saved meals and nutrition journal open food details directly and render protein meter',()=>{
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([{name:'След тренировка',items:[{id:'chicken',grams:'200'}]}]),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:120},
   entries:[{id:'e1',date:'2026-11-09',name:'Вечеря',items:[{id:'salmon',grams:'150'}]}]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/saved-ingredients[\s\S]*data-action="food-detail" data-id="chicken"/);
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 assert.match(app.node('modal-root').innerHTML,/Пилешки гърди/);
 app.click({dataset:{action:'close-modal'}});
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/journal-meters[\s\S]*progress goal-meter[\s\S]*progress goal-meter[\s\S]*width:26%/);
 assert.match(app.page(),/journal-entry[\s\S]*data-action="food-detail" data-id="salmon"/);
 app.click({dataset:{action:'food-detail',id:'salmon'}});
 assert.match(app.node('modal-root').innerHTML,/Сьомга/);
});

test('workoutDetail bridges to Progress logger and foodDetail logs directly to journal without altering plate',()=>{
 const app=boot('#sessions',{
  'forme-current-meal':JSON.stringify([{id:'rice',grams:'150'}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'workout-detail',id:'yoga-flow'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="workout-log-progress" data-id="yoga-flow"/);
 app.click({dataset:{action:'workout-log-progress',id:'yoga-flow'}});
 assert.equal(app.node('modal-root').innerHTML,'');
 assert.match(app.page(),/option value="yoga-flow" selected/);
 assert.match(app.page(),/id="log-workout-minutes" type="number" min="1" max="600" value="20"/);

 app.click({dataset:{action:'nav',page:'nutrition'}});
 app.click({dataset:{action:'food-detail',id:'banana'}});
 app.click({dataset:{action:'detail-preset-grams',id:'banana',grams:'150'}});
 app.click({dataset:{action:'detail-log-food',id:'banana'}});
 assert.equal(app.toast(),'Записът е запазен.');
 assert.equal(app.node('modal-root').innerHTML,'');
 assert.match(app.page(),/journal-entry[\s\S]*Банан[\s\S]*150 г/);
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'rice',grams:'150'}]);
});

test('workoutDetail schedules workout for today in 1 tap and weekly plan displays today completion mark',()=>{
 const app=boot('#home',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:12}],
   sets:[]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="workout-plan-today" data-id="cal-start"/);
 app.click({dataset:{action:'workout-plan-today',id:'cal-start'}});
 assert.equal(app.toast(),'Планът за тази дата е запазен.');
 assert.match(app.page(),/today-plan[\s\S]*Силна основа/);
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 assert.match(app.node('modal-root').innerHTML,/✓ Днес: с планирана тренировка/);
 app.click({dataset:{action:'close-modal'}});
 app.click({dataset:{action:'nav',page:'plan'}});
 assert.match(app.page(),/day-card-today[\s\S]*✓ Отбелязана като изпълнена: Силна основа/);
});

test('nutrition journal tab displays today entry count badge and progress displays personal record count',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[
    {id:'e1',date:'2026-11-09',name:'Закуска',items:[{id:'egg',grams:'100'}]},
    {id:'e2',date:'2026-11-09',name:'Обяд',items:[{id:'rice',grams:'150'}]}
   ]
  }),
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[],
   sets:[
    {id:'st1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:60},
    {id:'st2',exerciseId:'Pushups',date:'2026-11-09',kind:'reps',value:20}
   ]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/Дневник \(2\)/);
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/★ 2 · Личен рекорд/);
});

test('meal builder merges duplicate foods safely and displays percentage of daily calorie and protein goals',()=>{
 const app=boot('#nutrition',{
  'forme-current-meal':JSON.stringify([
   {id:'chicken',grams:'100'},
   {id:'rice',grams:'150'},
   {id:'chicken',grams:'100'}
  ]),
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/data-action="merge-meal"/);
 assert.match(app.page(),/meal-goal-share[\s\S]*22% kcal · 49% протеин/);
 app.click({dataset:{action:'merge-meal'}});
 assert.equal(app.toast(),'Еднаквите продукти са обединени.');
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]);
 assert.doesNotMatch(app.page(),/data-action="merge-meal"/);
});

test('journal entries can be loaded directly onto the meal plate as a fresh draft without entering edit mode',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'e1',date:'2026-11-09',name:'Обяд с ориз',items:[{id:'chicken',grams:'150'},{id:'rice',grams:'100'}]}]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 app.click({dataset:{action:'journal-load-meal',id:'e1'}});
 assert.equal(app.toast(),'Храненето е заредено.');
 assert.doesNotMatch(app.page(),/Редактираш запис от дневника/);
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'150'},{id:'rice',grams:'100'}]);
 assert.equal(app.node('meal-name').value,'Обяд с ориз');
});

test('four-week program cards display total session count and total scheduled minutes',()=>{
 const app=boot('#progress',{},new Date(2026,10,9,12));
 assert.match(app.page(),/program-meta">12 тренировки · \d+ мин/);
});

test('progress history paginates beyond 20 entries and set logger shows personal best hint',()=>{
 const sets=Array.from({length:23},(_,i)=>({
  id:'st-'+(i+1),
  exerciseId:'Plank',
  date:'2026-11-'+String((i%9)+1).padStart(2,'0'),
  kind:'seconds',
  value:30+i
 }));
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets})
 },new Date(2026,10,9,12));
 assert.equal((app.page().match(/class="progress-entry"/g)||[]).length,20);
 assert.match(app.page(),/data-action="progress-more">Покажи още \(3\)/);
 app.click({dataset:{action:'progress-more'}});
 assert.equal((app.page().match(/class="progress-entry"/g)||[]).length,23);
 assert.doesNotMatch(app.page(),/data-action="progress-more"/);
 app.change({id:'set-exercise',value:'Plank'});
 assert.match(app.node('set-best-hint').textContent,/★ Личен рекорд: 52 секунди/);
});

test('saved meals search filters by meal name and ingredient while preserving original item indices',()=>{
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([
   {name:'Сутрешна закуска',items:[{id:'oats',grams:'80'}]},
   {name:'След тренировка',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}
  ])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/id="saved-meal-search" type="search"/);
 app.input({dataset:{action:'saved-meal-search'},value:'пилешки'});
 assert.doesNotMatch(app.node('saved-meal-results').innerHTML,/Сутрешна закуска/);
 assert.match(app.node('saved-meal-results').innerHTML,/След тренировка[\s\S]*data-action="load-meal" data-index="1"/);
 app.click({dataset:{action:'load-meal',index:'1'}});
 assert.equal(app.node('meal-name').value,'След тренировка');
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]);
});

test('favorites and progress headers display live item counts and multilingual search controls render cleanly',()=>{
 for(const [lang,wkLabel,savedLabel] of [['bg','Търси тренировка','Търси в запазените хранения'],['en','Search workouts','Search saved meals'],['de','Training suchen','Gespeicherte Mahlzeiten durchsuchen']]){
  const app=boot('#favorites',{
   'forme-language':lang,
   'forme-favorites':JSON.stringify({exercises:['Plank','Pushups'],workouts:['cal-start']}),
   'forme-saved-meals':JSON.stringify([
    {name:'A',items:[{id:'oats',grams:'80'}]},
    {name:'B',items:[{id:'rice',grams:'150'}]}
   ]),
   'forme-progress-v1':JSON.stringify({
    version:1,
    goal:{workoutsPerWeek:3,minutesPerWeek:90},
    sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:12}],
    sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:45}]
   })
  },new Date(2026,10,9,12),true);
  assert.match(app.page(),/class="heading-count">3<\/span>/);
  app.click({dataset:{action:'nav',page:'progress'}});
  assert.match(app.page(),/class="heading-count">2<\/span>/);
  app.click({dataset:{action:'nav',page:'sessions'}});
  assert.ok(app.page().includes(wkLabel));
  app.click({dataset:{action:'nav',page:'nutrition'}});
  app.click({dataset:{action:'food-tab',tab:'saved'}});
  assert.ok(app.page().includes(savedLabel));
 }
});

test('meal builder adds custom gram amounts directly and nutrition journal displays remaining daily kcal and protein',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'e1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'}]}]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/id="meal-food-grams" inputmode="decimal" value="100"/);
 app.node('meal-food-select').value='rice';
 app.node('meal-food-grams').value='250';
 app.click({dataset:{action:'add-selected-food'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'rice',grams:'250'}]);
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/Остават до целта: 1\s?760 kcal · 55 г протеин/i);
});

test('consecutive workout days streak appears on Home and Progress when active 2 or more days in a row',()=>{
 const app=boot('#home',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[
    {id:'s1',workoutId:'cal-start',date:'2026-11-07',minutes:12},
    {id:'s2',workoutId:'mob-daily',date:'2026-11-08',minutes:10},
    {id:'s3',workoutId:'yoga-reset',date:'2026-11-09',minutes:12}
   ],
   sets:[]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/🔥 3 поредни дни/);
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/🔥 3 поредни дни/);
});

test('workoutDetail shows completion history count and foodDetail links back to saved meals containing that ingredient',()=>{
 const app=boot('#sessions',{
  'forme-saved-meals':JSON.stringify([{name:'След тренировка',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}]),
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[
    {id:'s1',workoutId:'cal-start',date:'2026-11-08',minutes:12},
    {id:'s2',workoutId:'cal-start',date:'2026-11-09',minutes:12}
   ],
   sets:[]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 assert.match(app.node('modal-root').innerHTML,/✓ 2 тренировки · 2026-11-09/);
 app.click({dataset:{action:'close-modal'}});
 app.click({dataset:{action:'nav',page:'nutrition'}});
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="detail-open-saved">След тренировка ↗/);
 app.click({dataset:{action:'detail-open-saved'}});
 assert.equal(app.node('modal-root').innerHTML,'');
 assert.match(app.page(),/След тренировка/);
});

test('meal builder quick portion presets, macro calorie split, and saved meal duplication work cleanly',()=>{
 const C=require('./core.js');
 const shares=C.macroCalorieShares({protein:25,carbs:50,fat:11.11});
 assert.equal(shares.proteinPct+shares.carbsPct+shares.fatPct,100);
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([{name:'Закуска',items:[{id:'oats',grams:'80'}]}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 app.node('meal-food-select').value='chicken';
 app.click({dataset:{action:'meal-preset-grams',grams:'200'}});
 assert.equal(app.node('meal-food-grams').value,'200');
 app.click({dataset:{action:'add-selected-food'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'200'}]);
 assert.match(app.page(),/class="meal-macro-split"/);
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 app.click({dataset:{action:'duplicate-saved-meal',index:'0'}});
 const saved=JSON.parse(app.storage['forme-saved-meals']);
 assert.equal(saved.length,2);
 assert.equal(saved[1].name,'Закуска (2)');
});

test('nutrition journal displays consecutive logging streak when entries exist on 2 or more consecutive days',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[
    {id:'n1',date:'2026-11-08',name:'Вчера',items:[{id:'egg',grams:'150'}]},
    {id:'n2',date:'2026-11-09',name:'Днес',items:[{id:'oats',grams:'100'}]}
   ]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/🔥 2 поредни дни/);
});

test('exerciseDetail displays recent logged sets history when 2 or more sets exist for that movement',()=>{
 const app=boot('#exercises',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[],
   sets:[
    {id:'st1',exerciseId:'Pushups',date:'2026-11-07',kind:'reps',value:12},
    {id:'st2',exerciseId:'Pushups',date:'2026-11-09',kind:'reps',value:18}
   ]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'exercise-detail',id:'Pushups'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/class="card-meta exercise-set-history"/);
 assert.match(modal,/2026-11-09: 18 повторения/);
 assert.match(modal,/2026-11-07: 12 повторения/);
});

test('Home and Weekly Plan allow 1-tap today completion toggle and balanced 3-day weekly preset',()=>{
 const app=boot('#home',{
  'forme-plan':JSON.stringify({mon:'cal-start'})
 },new Date(2026,10,9,12)); // 2026-11-09 is Monday
 assert.match(app.page(),/data-action="today-completion-add"/);
 app.click({dataset:{action:'today-completion-add'}});
 assert.deepEqual(JSON.parse(app.storage['forme-completed-workouts']),{'2026-11-09':{id:'cal-start',name:'Силна основа'}});
 assert.match(app.page(),/data-action="today-completion-remove"/);
 app.click({dataset:{action:'nav',page:'plan'}});
 assert.match(app.page(),/data-action="today-completion-remove"/);
 app.click({dataset:{action:'today-completion-remove'}});
 assert.deepEqual(JSON.parse(app.storage['forme-completed-workouts']),{});
 app.click({dataset:{action:'preset-balanced-plan'}});
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{mon:'cal-start',wed:'yoga-reset',fri:'mob-daily'});
});

test('activating a 4-week program reflects active scheduled slot count on Progress program cards',()=>{
 const app=boot('#progress',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'program-activate',id:'foundation'}});
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/12 тренировки · \d+ мин · ✓ 12 \/ 12/);
});

test('Favorites screen offers 1-tap clear-favorites and Progress offers two-step local data reset without window.confirm',()=>{
 const app=boot('#favorites',{
  'forme-language':'bg',
  'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Pushups']}),
  'forme-saved-meals':JSON.stringify([{name:'Обяд',items:[{id:'rice',grams:'150'}]}])
 },new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="clear-favorites"/);
 app.click({dataset:{action:'clear-favorites'}});
 assert.deepEqual(JSON.parse(app.storage['forme-favorites']),{exercises:[],workouts:[]});
 assert.doesNotMatch(app.page(),/data-action="clear-favorites"/);

 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/data-action="backup-reset-ask"/);
 app.click({dataset:{action:'backup-reset-ask'}});
 assert.match(app.page(),/data-action="backup-reset-confirm"/);
 app.click({dataset:{action:'backup-reset-cancel'}});
 assert.doesNotMatch(app.page(),/data-action="backup-reset-confirm"/);
 app.click({dataset:{action:'backup-reset-ask'}});
 app.click({dataset:{action:'backup-reset-confirm'}});
 assert.equal(app.storage['forme-saved-meals'],undefined);
 assert.equal(app.storage['forme-language'],'bg');
});

test('meal builder scales portions cleanly and nutrition journal shows active-day 7-day averages and protein goal hits',()=>{
 const C=require('./core.js');
 assert.deepEqual(C.scaleMealItems([{id:'chicken',grams:'200'},{id:'rice',grams:'150'}],0.5),[{id:'chicken',grams:'100'},{id:'rice',grams:'75'}]);
 const app=boot('#nutrition',{
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:40},
   entries:[
    {id:'e1',date:'2026-11-08',name:'Ден 1',items:[{id:'chicken',grams:'200'}]},
    {id:'e2',date:'2026-11-09',name:'Ден 2',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'200'}]}
   ]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 app.click({dataset:{action:'scale-meal',factor:'2'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'400'},{id:'rice',grams:'300'}]);
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/Средно за активните дни \(2\/7\): <strong>370 kcal<\/strong> · <strong>47,7 г протеин<\/strong> · ✓ 2\/7/);
});

test('Progress activity log marks PB sets with star badge and filters live by movement name or date with Escape clear',()=>{
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-08',minutes:12}],
   sets:[
    {id:'st1',exerciseId:'Pushups',date:'2026-11-07',kind:'reps',value:12},
    {id:'st2',exerciseId:'Pushups',date:'2026-11-09',kind:'reps',value:22}
   ]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/id="progress-search"/);
 assert.match(app.page(),/2026-11-09 · 22 повторения · ★/);
 assert.doesNotMatch(app.page(),/2026-11-07 · 12 повторения · ★/);
 const search={dataset:{action:'progress-search'},value:'Push-Ups'};
 app.input(search);
 assert.match(app.node('progress-history-results').innerHTML,/Лицеви опори/);
 assert.doesNotMatch(app.node('progress-history-results').innerHTML,/Силна основа/);
 app.keydown({key:'Escape',target:search,preventDefault(){}});
 assert.equal(search.value,'');
 assert.match(app.node('progress-history-results').innerHTML,/Силна основа/);
});

test('Exercises screen offers Favorites-only filter toggle when favorite exercises exist and resets cleanly',()=>{
 const app=boot('#exercises',{
  'forme-favorites':JSON.stringify({workouts:[],exercises:['Plank','Pullups']})
 },new Date(2026,10,9,12));
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-fav"/);
 app.click({dataset:{action:'toggle-ex-fav'}});
 assert.match(app.node('exercise-results').innerHTML,/Намерени 2 от 49 упражнения/);
 app.click({dataset:{action:'reset-filters',group:'exercises'}});
 assert.match(app.node('exercise-results').innerHTML,/Намерени 49 от 49 упражнения/);
});

test('Nutrition journal copies previous day entries when current day is empty and Progress removes 4-week program dates cleanly',()=>{
 const app=boot('#nutrition',{
  'forme-date-plans':JSON.stringify({'2026-11-10':'mob-daily'}),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[
    {id:'p1',date:'2026-11-08',name:'Закуска',items:[{id:'oats',grams:'80'}]},
    {id:'p2',date:'2026-11-08',name:'Обяд',items:[{id:'chicken',grams:'200'}]}
   ]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-copy-prev">\+ Копирай от предходния ден \(2\)/);
 app.click({dataset:{action:'journal-copy-prev'}});
 const todayEntries=JSON.parse(app.storage['forme-nutrition-v1']).entries.filter(e=>e.date==='2026-11-09');
 assert.equal(todayEntries.length,2);
 assert.doesNotMatch(app.page(),/data-action="journal-copy-prev"/);

 app.click({dataset:{action:'nav',page:'progress'}});
 app.click({dataset:{action:'program-activate',id:'foundation'}});
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/data-action="program-clear" data-id="foundation"/);
 app.click({dataset:{action:'program-clear',id:'foundation'}});
 assert.deepEqual(JSON.parse(app.storage['forme-date-plans']),{'2026-11-10':'mob-daily'});
 assert.doesNotMatch(app.page(),/data-action="program-clear" data-id="foundation"/);
});

test('Workouts screen shows completion counter chips on cards and filters by Favorites-only with clean reset',()=>{
 const app=boot('#sessions',{
  'forme-favorites':JSON.stringify({workouts:['cal-start','yoga-reset'],exercises:[]}),
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-08',minutes:12},{id:'s2',workoutId:'cal-start',date:'2026-11-09',minutes:15}],
   sets:[]
  })
 },new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/✓ 2×/);
 assert.match(app.node('workout-results').innerHTML,/data-action="toggle-wk-fav"/);
 app.click({dataset:{action:'toggle-wk-fav'}});
 assert.match(app.node('workout-results').innerHTML,/Намерени 2 от 6 тренировки/);
 app.click({dataset:{action:'reset-filters',group:'workouts'}});
 assert.match(app.node('workout-results').innerHTML,/Намерени 6 от 6 тренировки/);
});

test('Empty meal plate offers 1-tap saved meal shortcuts and Nutrition Journal displays daily macro calorie split',()=>{
 const app=boot('#nutrition',{
  'forme-saved-meals':JSON.stringify([{name:'След тренировка',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}]),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'n1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/data-action="load-meal" data-index="0"[^>]*>♡ След тренировка/);
 app.click({dataset:{action:'load-meal',index:'0'}});
 assert.equal(JSON.parse(app.storage['forme-current-meal']).length,2);

 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/class="journal-macro-split">Протеин \d+% · Въглехидрати \d+% · Мазнини \d+%</);
});

test('Progress screen showcases Personal Records board and pre-fills set form on 1-tap pick',()=>{
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[],
   sets:[
    {id:'st1',exerciseId:'Plank',date:'2026-11-08',kind:'seconds',value:75},
    {id:'st2',exerciseId:'Pullups',date:'2026-11-09',kind:'reps',value:14}
   ]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/★ Лични рекорди/);
 assert.match(app.page(),/class="panel pr-board"/);
 assert.match(app.page(),/★ 14 повторения · 2026-11-09/);
 app.click({dataset:{action:'progress-pick-exercise',id:'Pullups'}});
 assert.match(app.page(),/<option value="Pullups" selected>/);
 assert.equal(app.node('set-value').value,'14');
});

test('Home rest day shows next planned workout within 7 days and Month Calendar resets a single date override in 1 tap',()=>{
 const app=boot('#home',{
  'forme-plan':JSON.stringify({wed:'yoga-reset'}),
  'forme-date-plans':JSON.stringify({'2026-11-10':'mob-daily'})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/Няма планирана тренировка/);
 assert.match(app.page(),/Следва по план: ВТО · Движи се свободно/);

 app.click({dataset:{action:'nav',page:'plan'}});
 app.click({dataset:{action:'plan-view',view:'month'}});
 app.click({dataset:{action:'plan-date',date:'10'}});
 assert.match(app.page(),/data-action="reset-date-plan"/);
 app.click({dataset:{action:'reset-date-plan'}});
 assert.deepEqual(JSON.parse(app.storage['forme-date-plans']),{});
 assert.doesNotMatch(app.page(),/data-action="reset-date-plan"/);
});

test('First-time empty plate offers USDA starter meal templates and food detail computes exact grams for 25g protein',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 assert.match(app.node('modal-root').innerHTML,/data-grams="111"[^>]*>25 г протеин \(111 г\)/);
 app.click({dataset:{action:'detail-preset-grams',id:'chicken',grams:'111'}});
 assert.equal(app.node('detail-grams').value,'111');
 app.click({dataset:{action:'close-modal'}});

 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/data-action="meal-starter" data-template="lunch"/);
 app.click({dataset:{action:'meal-starter',template:'lunch'}});
 assert.equal(JSON.parse(app.storage['forme-current-meal']).length,3);
 assert.equal(app.node('meal-name').value,'Пилешко с ориз');
});

test('Weekly plan supports Strength and Mobility 3-day presets and workout detail schedules tomorrow in 1 tap',()=>{
 const app=boot('#plan',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'preset-strength-plan'}});
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{mon:'cal-start',wed:'cal-control',fri:'cal-start'});
 app.click({dataset:{action:'preset-mobility-plan'}});
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{mon:'mob-daily',wed:'yoga-flow',fri:'mob-deep'});

 app.click({dataset:{action:'nav',page:'sessions'}});
 app.click({dataset:{action:'workout-detail',id:'cal-control'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="workout-plan-tomorrow"/);
 app.click({dataset:{action:'workout-plan-tomorrow',id:'cal-control'}});
 assert.equal(JSON.parse(app.storage['forme-date-plans'])['2026-11-10'],'cal-control');
});

test('Progress page summarizes all-time totals and most-practiced workout and triggers clean print view',()=>{
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[
    {id:'s1',workoutId:'cal-start',date:'2026-10-01',minutes:12},
    {id:'s2',workoutId:'cal-start',date:'2026-11-08',minutes:12},
    {id:'s3',workoutId:'yoga-flow',date:'2026-11-09',minutes:18}
   ],
   sets:[{id:'t1',exerciseId:'Pushups',date:'2026-11-08',kind:'reps',value:15}]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/class="subtle progress-lifetime"[\s\S]*3 тренировки[\s\S]*42 мин[\s\S]*1 серии[\s\S]*★ Силна основа \(2×\)/);
 let printed=0;
 app.window.print=()=>{printed++;};
 app.click({dataset:{action:'progress-print'}});
 assert.equal(printed,1);
});

test('Workout player renders live round circuit step strip marking completed and active exercises',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 assert.match(app.node('player-layout').innerHTML,/class="card-meta player-round-steps"[\s\S]*<span class="chip active">1\. /);
 app.click({dataset:{action:'player-start'}});
 app.click({dataset:{action:'player-next'}});
 assert.match(app.node('player-layout').innerHTML,/class="card-meta player-round-steps"[\s\S]*<span class="chip">✓ /);
});

test('Home overview renders labeled protein meter alongside workout/kcal meters and nutrition streak and opens upcoming rest-day workout',()=>{
 const app=boot('#home',{
  'forme-plan':JSON.stringify({wed:'cal-control'}),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[
    {id:'n1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'}]},
    {id:'n2',date:'2026-11-10',name:'Обяд',items:[{id:'chicken',grams:'200'}]}
   ]
  })
 },new Date(2026,10,10,12));
 assert.match(app.page(),/🔥 2 поредни дни/);
 assert.match(app.page(),/<small>Протеин<\/small><div class="progress goal-meter"><span style="width:45%"><\/span>/);
 assert.match(app.page(),/class="subtle today-next-up"[\s\S]*data-action="workout-detail" data-id="cal-control"/);
});

test('Favorite foods work across cards, food detail modal, library fav-only filter, Favorites page and JSON backup',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'favorite',kind:'foods',id:'salmon'}});
 assert.deepEqual(JSON.parse(app.storage['forme-favorites']),{exercises:[],workouts:[],foods:['salmon']});
 assert.match(app.node('food-results').innerHTML,/data-action="toggle-food-fav"[^>]*>♥ Само любими \(1\)/);
 app.click({dataset:{action:'toggle-food-fav'}});
 assert.equal((app.node('food-results').innerHTML.match(/class="card food-card"/g)||[]).length,1);
 assert.match(app.node('food-results').innerHTML,/Сьомга/);

 app.click({dataset:{action:'nav',page:'favorites'}});
 assert.match(app.page(),/Любими храни<\/h2><span class="subtle">1<\/span>[\s\S]*Сьомга/);
 const exported=app.window.FORME_BACKUP.exportData({getItem:k=>app.storage[k]??null});
 assert.equal(app.window.FORME_BACKUP.validate(JSON.parse(exported)),true);
 assert.deepEqual(JSON.parse(JSON.parse(exported).data['forme-favorites']).foods,['salmon']);
});

test('PR board shows progression gain since earliest set and set form provides quick ±1/±5 value steppers',()=>{
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[],
   sets:[
    {id:'s1',exerciseId:'Pushups',date:'2026-10-15',kind:'reps',value:10},
    {id:'s2',exerciseId:'Pushups',date:'2026-11-09',kind:'reps',value:18}
   ]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/class="pr-entry"[\s\S]*★ 18 повторения · 2026-11-09 · ↑ \+8/);
 app.node('set-value').value='10';
 app.click({dataset:{action:'step-set-value',delta:'5'}});
 assert.equal(app.node('set-value').value,'15');
 app.click({dataset:{action:'step-set-value',delta:'-1'}});
 assert.equal(app.node('set-value').value,'14');
});

test('Nutrition journal renders 25g daily fiber meter, 1-tap saved meal logging on empty day, and pins favorite foods first in meal builder',()=>{
 const app=boot('#nutrition',{
  'forme-favorites':JSON.stringify({exercises:[],workouts:[],foods:['avocado']}),
  'forme-saved-meals':JSON.stringify([{name:'Овесена закуска',items:[{id:'oats',grams:'100'}]}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/<select id="meal-food-select"><option value="avocado">♥ Авокадо/);

 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="log-saved-meal" data-index="0"[^>]*>\+ ♡ Овесена закуска/);
 app.click({dataset:{action:'log-saved-meal',index:'0'}});
 assert.match(app.page(),/<small>Фибри \(25 г\)<\/small><div class="progress goal-meter"><span style="width:4[0-4]%"><\/span>/);
});

test('Exercise detail recommends related movements and includes a bodyweight alternative when viewing equipment-based exercises',()=>{
 const app=boot('#exercises',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'exercise-detail',id:'Pullups'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/<h3>Подобни движения<\/h3>/);
 assert.match(modal,/Без оборудване ↗/);
});

test('Weekly plan displays category balance breakdown and Month Calendar pre-fills exact date into Progress workout log',()=>{
 const app=boot('#plan',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'preset-balanced-plan'}});
 assert.match(app.page(),/Калистеника 1 · Йога 1 · Мобилност 1/);

 app.click({dataset:{action:'plan-view',view:'month'}});
 app.click({dataset:{action:'plan-date',date:'2'}});
 assert.match(app.page(),/data-action="month-log-workout" data-id="cal-start" data-date="2026-11-02"/);
 app.click({dataset:{action:'month-log-workout',id:'cal-start',date:'2026-11-02'}});
 assert.match(app.page(),/id="log-workout-date" type="date" value="2026-11-02"/);
});

test('Workout player offers 1-tap Gentle, Standard and Intense pacing presets before starting',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 assert.match(app.node('player-layout').innerHTML,/data-action="set-player-pace" data-pace="default" aria-pressed="true"/);
 app.click({dataset:{action:'set-player-pace',pace:'intense'}});
 assert.match(app.node('player-layout').innerHTML,/data-action="set-player-pace" data-pace="intense" aria-pressed="true"/);
 assert.match(app.node('player-layout').innerHTML,/id="work-seconds"[^>]*value="50"/);
 app.click({dataset:{action:'player-start'}});
 assert.doesNotMatch(app.node('player-layout').innerHTML,/data-action="set-player-pace"/);
});

test('Food detail recommends similar USDA foods from the same food group with 1-tap navigation',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/<h3>Подобни храни<\/h3>/);
 assert.match(modal,/data-action="food-detail" data-id="(tuna|turkey|cottage|greek|salmon|egg)"/);
});

test('Detail modals support Prev/Next buttons and ArrowLeft/ArrowRight keyboard browsing across filtered catalog items',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 assert.match(app.node('modal-root').innerHTML,/1 \/ 6/);
 app.click({dataset:{action:'detail-step',dir:'1'}});
 assert.match(app.node('modal-root').innerHTML,/2 \/ 6/);
 assert.match(app.node('modal-root').innerHTML,/<h2>Контрол и сила<\/h2>/);
 app.keydown({key:'ArrowLeft',target:{tagName:'DIV'},preventDefault(){}});
 assert.match(app.node('modal-root').innerHTML,/<h2>Силна основа<\/h2>/);
});

test('Finished workout player displays session summary and 1-tap set-logging chips for every included movement',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 app.click({dataset:{action:'player-start'}});
 for(let i=0;i<30;i++){
  if(/player-done-summary/.test(app.node('player-layout').innerHTML))break;
  app.click({dataset:{action:'player-next'}});
 }
 const doneHtml=app.node('player-layout').innerHTML;
 assert.match(doneHtml,/class="card-meta player-done-summary"/);
 assert.match(doneHtml,/class="card-meta player-done-exercises"[\s\S]*data-action="exercise-log-set" data-id="Plank"/);
 app.click({dataset:{action:'exercise-log-set',id:'Plank'}});
 assert.match(app.page(),/<option value="Plank" selected>/);
});

test('Meal builder shows live per-ingredient kcal/protein breakdown and supports ±25 g stepper buttons',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 app.click({dataset:{action:'add-food',id:'chicken'}});
 assert.match(app.page(),/id="meal-item-meta-0"[^>]*>120 kcal · 22,5 г протеин/);
 app.click({dataset:{action:'step-meal-grams',index:'0',delta:'25'}});
 assert.equal(JSON.parse(app.storage['forme-current-meal'])[0].grams,'125');
 assert.match(app.page(),/id="meal-item-meta-0"[^>]*>150 kcal · 28,1 г протеин/);
 app.input({dataset:{action:'meal-grams',index:'0'},value:'200',classList:{toggle(){}}});
 assert.match(app.node('meal-item-meta-0').textContent,/240 kcal · 45 г протеин/);
});

test('Active 4-week program cards track completed scheduled sessions and advance 1-tap next-workout launch',()=>{
 const app=boot('#progress',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'program-activate',id:'foundation'}});
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.match(app.page(),/✓ 12 \/ 12/);
 assert.match(app.page(),/▶ 11-09 · Силна основа/);
 app.node('log-workout-id').value='cal-start';
 app.node('log-workout-date').value='2026-11-09';
 app.node('log-workout-minutes').value='12';
 app.click({dataset:{action:'progress-workout'}});
 assert.match(app.page(),/✓ 12 \/ 12 · ★ 1 \/ 12/);
 assert.match(app.page(),/▶ 11-11 · Спокойно възстановяване/);
});

test('Pressing / focuses the active screen search input without intercepting typing inside form controls',()=>{
 const app=boot('#exercises',{},new Date(2026,10,9,12));
 let focusedEx=false,prevented=false;
 app.node('ex-search').focus=()=>{focusedEx=true;};
 app.keydown({key:'/',target:{tagName:'DIV'},preventDefault(){prevented=true;}});
 assert.equal(focusedEx,true);
 assert.equal(prevented,true);

 focusedEx=false;prevented=false;
 app.keydown({key:'/',target:{tagName:'INPUT'},preventDefault(){prevented=true;}});
 assert.equal(focusedEx,false);
 assert.equal(prevented,false);

 app.click({dataset:{action:'nav',page:'nutrition'}});
 let focusedFood=false;
 app.node('food-search').focus=()=>{focusedFood=true;};
 app.keydown({key:'/',target:{tagName:'BUTTON'},preventDefault(){}});
 assert.equal(focusedFood,true);
});

test('Nutrition journal entries display per-meal fiber and support 1-tap same-day duplication',()=>{
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:120},entries:[{id:'n-oats',date:'2026-11-09',name:'Закуска',items:[{id:'oats',grams:'100'}]}]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/10,1 г фибри/);
 assert.equal((app.page().match(/class="journal-entry"/g)||[]).length,1);
 app.click({dataset:{action:'journal-duplicate',id:'n-oats'}});
 assert.equal((app.page().match(/class="journal-entry"/g)||[]).length,2);
 assert.match(app.page(),/Фибри: 20,2 г/);
});

test('Progress history entries offer 1-tap repeat pre-fill for both workouts and exercise sets',()=>{
 const app=boot('#progress',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'s-1',workoutId:'mob-daily',date:'2026-11-06',minutes:14}],sets:[{id:'st-1',exerciseId:'Pullups',date:'2026-11-07',kind:'reps',value:9}]})},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="progress-repeat" data-type="set" data-id="Pullups"/);
 app.click({dataset:{action:'progress-repeat',type:'set',id:'Pullups',kind:'reps',value:'9'}});
 assert.match(app.page(),/<option value="Pullups" selected>/);
 assert.equal(app.node('set-value').value,'9');

 app.click({dataset:{action:'progress-repeat',type:'workout',id:'mob-daily',minutes:'14'}});
 assert.match(app.page(),/<option value="mob-daily" selected>/);
 assert.equal(app.node('log-workout-minutes').value,'14');
});

test('Workout detail modal shows personal record badges and 1-tap set-logging buttons on included exercises',()=>{
 const app=boot('#sessions',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'st-p',exerciseId:'Pushups',date:'2026-11-08',kind:'reps',value:18}]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 const html=app.node('modal-root').innerHTML;
 assert.match(html,/Лицеви опори[\s\S]*★ 18 повторения/);
 assert.match(html,/data-action="exercise-log-set" data-id="Pushups"/);
 app.click({dataset:{action:'exercise-log-set',id:'Pushups'}});
 assert.match(app.page(),/<option value="Pushups" selected>/);
});

test('Meal builder add bar dynamically updates 25 g target-protein portion preset when switching food selection',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/data-action="meal-preset-grams" data-grams="111"[^>]*>25 г протеин \(111 г\)/);
 app.node('meal-food-grams').value='100';
 app.change({id:'meal-food-select',value:'egg',dataset:{}});
 assert.match(app.node('meal-presets').innerHTML,/25 г протеин \(199 г\)/);
 app.change({id:'meal-food-select',value:'apple',dataset:{}});
 assert.doesNotMatch(app.node('meal-presets').innerHTML,/25 г протеин/);
});

test('Favorites page adds all non-duplicate favorite foods directly to Meal Builder in 1 tap',()=>{
 const app=boot('#favorites',{'forme-favorites':JSON.stringify({exercises:[],workouts:[],foods:['oats','greek','banana']}),'forme-current-meal':JSON.stringify([{id:'oats',grams:'80'}])},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="favorites-to-meal"/);
 app.click({dataset:{action:'favorites-to-meal'}});
 const meal=JSON.parse(app.storage['forme-current-meal']);
 assert.deepEqual(meal,[{id:'oats',grams:'80'},{id:'greek',grams:'100'},{id:'banana',grams:'100'}]);
 assert.equal((app.page().match(/class="meal-row"/g)||[]).length,3);
});

test('Alt+1..Alt+7 keyboard shortcuts switch between main screens without intercepting Ctrl/Cmd or open modals',()=>{
 const app=boot('#home',{},new Date(2026,10,9,12));
 let prevented=false;
 app.keydown({key:'6',altKey:true,ctrlKey:false,metaKey:false,preventDefault(){prevented=true;}});
 assert.equal(prevented,true);
 assert.match(app.page(),/ТВОЕТО ДВИЖЕНИЕ/);

 prevented=false;
 app.keydown({key:'2',altKey:true,ctrlKey:true,metaKey:false,preventDefault(){prevented=true;}});
 assert.equal(prevented,false);
 assert.match(app.page(),/ТВОЕТО ДВИЖЕНИЕ/);

 app.keydown({key:'4',altKey:true,ctrlKey:false,metaKey:false,preventDefault(){}});
 assert.match(app.page(),/ХРАНИ СЕ ОСЪЗНАТО/);
});

test('Exercise catalog cards expose a 1-tap set-logging button that opens Progress with the movement pre-selected',()=>{
 const app=boot('#exercises',{},new Date(2026,10,9,12));
 assert.match(app.node('exercise-results').innerHTML,/data-action="exercise-log-set" data-id="Plank"/);
 app.click({dataset:{action:'exercise-log-set',id:'Plank'}});
 assert.match(app.page(),/<option value="Plank" selected>/);
 assert.match(app.page(),/<option value="seconds" selected>/);
});

test('Food catalog cards allow 1-tap logging of 100 g directly into today’s Nutrition Journal',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 assert.match(app.node('food-results').innerHTML,/data-action="quick-log-food" data-id="banana"/);
 app.click({dataset:{action:'quick-log-food',id:'banana'}});
 assert.match(app.page(),/>Дневник \(1\)</);
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/Банан/);
});

test('Nutrition Journal daily goal presets save kcal and protein targets in 1 tap',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-goal-preset" data-kcal="2500" data-protein="160" aria-pressed="false"/);
 app.click({dataset:{action:'journal-goal-preset',kcal:'2500',protein:'160'}});
 assert.match(app.page(),/0 \/ 2500 kcal/);
 assert.match(app.page(),/Протеин: 0 \/ 160 г/);
 assert.match(app.page(),/data-action="journal-goal-preset" data-kcal="2500" data-protein="160" aria-pressed="true"/);
});

test('Progress weekly goal presets update weekly workout and minute targets in 1 tap',()=>{
 const app=boot('#progress',{},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="progress-goal-preset" data-workouts="5" data-minutes="150" aria-pressed="false"/);
 app.click({dataset:{action:'progress-goal-preset',workouts:'5',minutes:'150'}});
 assert.match(app.page(),/<strong>0 \/ 5<\/strong>/);
 assert.match(app.page(),/<strong>0 \/ 150<\/strong>/);
 assert.match(app.page(),/data-action="progress-goal-preset" data-workouts="5" data-minutes="150" aria-pressed="true"/);
});

test('Home overview surfaces an active draft plate summary with a 1-tap Continue Meal button',()=>{
 const app=boot('#home',{'forme-current-meal':JSON.stringify([{id:'chicken',grams:'200'},{id:'banana',grams:'100'}])},new Date(2026,10,9,12));
 assert.match(app.page(),/home-draft-meal">Сглоби хранене \(2\): <strong>329 kcal<\/strong>/);
 assert.match(app.page(),/data-action="go-meal">Сглоби хранене \(2\) →/);
 app.click({dataset:{action:'go-meal'}});
 assert.match(app.page(),/Твоите продукти/);
});

test('Activity CSV export generates UTF-8 BOM RFC 4180 spreadsheet rows and neutralizes formula injection',()=>{
 const core=require('./core.js');
 const csv=core.exportActivityCsv({
  sessions:[{date:'2026-11-08',title:'Силна основа',minutes:18}],
  sets:[{date:'2026-11-09',title:'Планк, класически',kind:'seconds',value:65}],
  nutritionEntries:[{date:'2026-11-09',title:'=Обяд "Протеин"',itemsCount:2,kcal:540.44,protein:48.2,carbs:52.1,fat:11.3,fiber:6.8}]
 });
 assert.ok(csv.startsWith('\uFEFFdate,type,name,metric,value,kcal,protein_g,carbs_g,fat_g,fiber_g\r\n'));
 assert.match(csv,/2026-11-09,set,"Планк, класически",seconds,65,,,,,\r\n/);
 assert.match(csv,/2026-11-09,nutrition,"'=Обяд ""Протеин""",meal,2,540\.4,48\.2,52\.1,11\.3,6\.8\r\n/);
 assert.match(csv,/2026-11-08,workout,Силна основа,minutes,18,,,,,\r\n/);
 const app=boot('#progress',{},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="backup-export-csv">Изтегли CSV<\/button>/);
});

test('Meal Builder offers 1-tap meal-slot name presets for saving and logging meals without typing',()=>{
 const app=boot('#nutrition',{'forme-current-meal':JSON.stringify([{id:'oats',grams:'80'}])},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/data-action="meal-name-preset" data-slot="breakfast" data-name="Закуска" aria-pressed="false"/);
 app.click({dataset:{action:'meal-name-preset',slot:'breakfast',name:'Закуска'}});
 assert.equal(app.node('meal-name').value,'Закуска');
 assert.match(app.node('meal-name-presets').innerHTML,/data-slot="breakfast" data-name="Закуска" aria-pressed="true"/);
 app.click({dataset:{action:'save-meal'}});
 assert.match(app.page(),/<h4>Закуска<\/h4>/);
});

test('Saved Meals shows per-meal fiber and sorts by highest protein while preserving original item indices',()=>{
 const app=boot('#nutrition',{'forme-saved-meals':JSON.stringify([
  {name:'Лека закуска',items:[{id:'oats',grams:'100'}]},
  {name:'Протеинов обяд',items:[{id:'chicken',grams:'200'}]}
 ])},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/10,1 г фибри/);
 app.change({id:'saved-meal-sort',dataset:{action:'saved-meal-sort'},value:'protein'});
 const html=app.node('saved-meal-results').innerHTML;
 assert.ok(html.indexOf('Протеинов обяд')<html.indexOf('Лека закуска'));
 assert.match(html,/Протеинов обяд[\s\S]*?data-action="load-meal" data-index="1"/);
});

test('Nutrition Journal 2-step Clear Day removes only the selected date entries and preserves other dates',()=>{
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[
  {id:'e1',date:'2026-11-09',name:'Закуска',items:[{id:'oats',grams:'80'}]},
  {id:'e2',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'}]},
  {id:'e3',date:'2026-11-08',name:'Вчерашна вечеря',items:[{id:'salmon',grams:'180'}]}
 ]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-clear-day-ask">Изчисти деня<\/button>/);
 app.click({dataset:{action:'journal-clear-day-ask'}});
 assert.match(app.page(),/data-action="journal-clear-day-confirm"/);
 app.click({dataset:{action:'journal-clear-day-cancel'}});
 assert.match(app.page(),/Обяд/);
 app.click({dataset:{action:'journal-clear-day-ask'}});
 app.click({dataset:{action:'journal-clear-day-confirm'}});
 assert.match(app.page(),/Все още няма записани хранения за тази дата/);
 const stored=JSON.parse(app.storage['forme-nutrition-v1']);
 assert.equal(stored.entries.length,1);
 assert.equal(stored.entries[0].date,'2026-11-08');
});

test('Workout catalog cards expose a 1-tap + Today scheduling button and switch to a ✓ Today badge',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/data-action="workout-plan-today" data-id="mob-daily"/);
 app.click({dataset:{action:'workout-plan-today',id:'mob-daily'}});
 assert.match(app.node('workout-results').innerHTML,/✓ Днес/);
 assert.doesNotMatch(app.node('workout-results').innerHTML,/data-action="workout-plan-today" data-id="mob-daily"/);
});

test('Completed Workout Player offers a 1-tap + Tomorrow scheduling action when tomorrow is free',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'start-workout',id:'mob-daily'}});
 app.click({dataset:{action:'player-start'}});
 for(let i=0;i<24;i++)app.click({dataset:{action:'player-next'}});
 assert.match(app.node('player-layout').innerHTML,/data-action="workout-plan-tomorrow" data-id="mob-daily"/);
 app.click({dataset:{action:'workout-plan-tomorrow',id:'mob-daily'}});
 const datePlans=JSON.parse(app.storage['forme-date-plans']);
 assert.equal(datePlans['2026-11-10'],'mob-daily');
});

test('Exercise detail modal supports inline set logging with ±5 steppers and updates PR growth delta in place',()=>{
 const app=boot('#exercises',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'st-1',exerciseId:'Plank',date:'2026-11-05',kind:'seconds',value:45}]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'exercise-detail',id:'Plank'}});
 assert.match(app.node('modal-root').innerHTML,/id="detail-set-value"[^>]*value="45"/);
 app.node('detail-set-value').value='45';
 app.click({dataset:{action:'detail-step-set',delta:'5'}});
 app.click({dataset:{action:'detail-step-set',delta:'5'}});
 assert.equal(app.node('detail-set-value').value,'55');
 app.click({dataset:{action:'detail-save-set',id:'Plank',kind:'seconds'}});
 assert.match(app.node('modal-root').innerHTML,/★ Личен рекорд: 55 секунди · 2026-11-09 · ↑ \+10/);
 assert.match(app.node('exercise-results').innerHTML,/★ 55 секунди/);
});

test('Food detail modal displays live daily goal percentages and macro calorie split as portion changes',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 assert.match(app.node('modal-root').innerHTML,/detail-macro-summary">6% kcal · 23% протеин/);
 app.click({dataset:{action:'detail-preset-grams',id:'chicken',grams:'200'}});
 assert.match(app.node('detail-table').innerHTML,/detail-macro-summary">12% kcal · 45% протеин/);
});

test('Meal Builder computes a 1-tap remaining daily protein portion preset for the selected food',()=>{
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:85},entries:[{id:'e1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'}]}]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 app.change({id:'meal-food-select',value:'chicken'});
 assert.match(app.node('meal-presets').innerHTML,/data-action="meal-preset-grams" data-grams="178"[^>]*>✓ 40 г протеин \(178 г\)/);
 app.click({dataset:{action:'meal-preset-grams',grams:'178'}});
 assert.equal(app.node('meal-food-grams').value,'178');
});

test('Progress lifetime summary shows category balance and history filter isolates ★ personal record sets',()=>{
 const app=boot('#progress',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-08',minutes:18},{id:'s2',workoutId:'mob-daily',date:'2026-11-09',minutes:10}],sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-07',kind:'seconds',value:40},{id:'st2',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:65}]})},new Date(2026,10,9,12));
 assert.match(app.page(),/progress-lifetime[\s\S]*Калистеника 1 · Мобилност 1/);
 app.click({dataset:{action:'progress-filter',view:'pr'}});
 assert.match(app.page(),/data-action="progress-filter" data-view="pr" aria-pressed="true"/);
 assert.match(app.page(),/2026-11-09 · 65 секунди · ★/);
 assert.doesNotMatch(app.page(),/2026-11-07 · 40 секунди/);
});

test('Weekly plan rotates forward and backward by 1 day with wrap-around via shift-plan',()=>{
 const app=boot('#plan',{'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset',sun:'mob-daily'})},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="shift-plan" data-delta="-1"/);
 assert.match(app.page(),/data-action="shift-plan" data-delta="1"/);
 app.click({dataset:{action:'shift-plan',delta:'1'}});
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{mon:'mob-daily',tue:'cal-start',thu:'yoga-reset'});
 app.click({dataset:{action:'shift-plan',delta:'-1'}});
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{mon:'cal-start',wed:'yoga-reset',sun:'mob-daily'});
});

test('Month calendar selection copies a date-specific workout +7 days ahead in 1 tap',()=>{
 const app=boot('#plan',{'forme-date-plans':JSON.stringify({'2026-11-09':'yoga-flow'})},new Date(2026,10,9,12));
 app.click({dataset:{action:'plan-view',view:'month'}});
 app.click({dataset:{action:'plan-date',date:'9'}});
 assert.match(app.page(),/data-action="copy-date-next-week" data-id="yoga-flow" data-date="2026-11-16"/);
 app.click({dataset:{action:'copy-date-next-week',id:'yoga-flow',date:'2026-11-16'}});
 assert.equal(JSON.parse(app.storage['forme-date-plans'])['2026-11-16'],'yoga-flow');
 assert.doesNotMatch(app.page(),/data-action="copy-date-next-week"/);
});

test('Workout detail shows cumulative logged minutes and favorites all included exercises in 1 tap',()=>{
 const app=boot('#sessions',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-08',minutes:18},{id:'s2',workoutId:'cal-start',date:'2026-11-09',minutes:19}],sets:[]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 assert.match(app.node('modal-root').innerHTML,/✓ 2 тренировки · 2026-11-09 · 37 мин/);
 assert.match(app.node('modal-root').innerHTML,/data-action="workout-fav-exercises" data-id="cal-start"/);
 app.click({dataset:{action:'workout-fav-exercises',id:'cal-start'}});
 assert.deepEqual(JSON.parse(app.storage['forme-favorites']).exercises,['Bodyweight_Squat','Pushups','Plank','Mountain_Climbers']);
 assert.match(app.node('modal-root').innerHTML,/✓ ♥ Любими/);
});

test('Favorites page renders a summary overview strip and logs all favorite foods to today journal in 1 tap',()=>{
 const app=boot('#favorites',{'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank'],foods:['chicken','oats']})},new Date(2026,10,9,12));
 assert.match(app.page(),/plan-summary"><strong>♥ 4<\/strong><span>1 тренировки \(12 мин\) · 1 упражнения · 2 храни \(499 kcal/);
 assert.match(app.page(),/data-action="favorites-to-journal"/);
 app.click({dataset:{action:'favorites-to-journal'}});
 const entries=JSON.parse(app.storage['forme-nutrition-v1']).entries;
 assert.equal(entries.length,1);
 assert.equal(entries[0].date,'2026-11-09');
 assert.equal(entries[0].name,'Любими храни');
 assert.deepEqual(entries[0].items,[{id:'chicken',grams:'100'},{id:'oats',grams:'100'}]);
});

test('Nutrition journal loads an entire multi-entry day into Meal Builder with merged food grams',()=>{
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:120},entries:[{id:'e1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'120'},{id:'rice',grams:'150'}]},{id:'e2',date:'2026-11-09',name:'Вечеря',items:[{id:'chicken',grams:'130'}]}]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-load-day-meal"/);
 app.click({dataset:{action:'journal-load-day-meal'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'250'},{id:'rice',grams:'150'}]);
 assert.equal(app.node('meal-name').value,'2026-11-09');
});

test('Progress backup panel renders non-destructive #backup-merge-file input alongside destructive restore',async()=>{
 const app=boot('#progress',{'forme-plan':JSON.stringify({mon:'cal-start'})},new Date(2026,10,9,12));
 assert.match(app.page(),/id="backup-merge-file" type="file"/);
 const archive=JSON.stringify({app:'FORME',version:1,data:{'forme-plan':JSON.stringify({fri:'yoga-reset'})}});
 app.change({id:'backup-merge-file',value:'archive.json',files:[{text:()=>Promise.resolve(archive)}]});
 await Promise.resolve();
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{mon:'cal-start',fri:'yoga-reset'});
 assert.match(app.toast(),/Архивът е обединен/);
});

test('Keyboard shortcuts help modal opens via ? key or open-shortcuts button and closes on Escape',()=>{
 const app=boot('#home',{'forme-language':'en'},new Date(2026,10,9,12),true);
 app.keydown({key:'?',target:{tagName:'BODY'},preventDefault(){}});
 assert.match(app.node('modal-root').innerHTML,/<h2>Keyboard shortcuts<\/h2>/);
 assert.match(app.node('modal-root').innerHTML,/Alt \+ 1…7/);
 app.keydown({key:'Escape',target:{tagName:'BUTTON'},preventDefault(){}});
 assert.equal(app.node('modal-root').innerHTML,'');
 app.click({dataset:{action:'open-shortcuts'}});
 assert.match(app.node('modal-root').innerHTML,/<h2>Keyboard shortcuts<\/h2>/);
});

test('Home rest day offers 1-tap pull-forward of the next planned workout to today',()=>{
 const app=boot('#home',{'forme-plan':JSON.stringify({wed:'yoga-flow'})},new Date(2026,10,9,12));
 assert.match(app.page(),/today-plan-actions[\s\S]*data-action="workout-plan-today" data-id="yoga-flow">\+ Днес: Дълбоко разтягане/);
 app.click({dataset:{action:'workout-plan-today',id:'yoga-flow'}});
 assert.equal(JSON.parse(app.storage['forme-date-plans'])['2026-11-09'],'yoga-flow');
 assert.match(app.page(),/today-plan-actions[\s\S]*data-action="start-workout" data-id="yoga-flow"/);
});

test('Workout player offers 1-tap round count selector before starting and updates total steps and remaining time',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 assert.match(app.node('player-layout').innerHTML,/УПРАЖНЕНИЕ 1 \/ 12 · КРЪГ 1 \/ 3/);
 assert.match(app.node('player-layout').innerHTML,/id="player-total-remaining">11:40<\/b>/);
 assert.match(app.node('player-layout').innerHTML,/data-action="set-player-rounds" data-rounds="3" aria-pressed="true">Кръгове: 3/);

 app.click({dataset:{action:'set-player-rounds',rounds:'1'}});
 assert.match(app.node('player-layout').innerHTML,/УПРАЖНЕНИЕ 1 \/ 4/);
 assert.match(app.node('player-layout').innerHTML,/id="player-total-remaining">03:40<\/b>/);
 assert.doesNotMatch(app.node('player-layout').innerHTML,/КРЪГ 1/);
 assert.match(app.node('player-layout').innerHTML,/data-action="set-player-rounds" data-rounds="1" aria-pressed="true">Кръгове: 1/);

 app.click({dataset:{action:'set-player-rounds',rounds:'4'}});
 assert.match(app.node('player-layout').innerHTML,/УПРАЖНЕНИЕ 1 \/ 16 · КРЪГ 1 \/ 4/);
 assert.match(app.node('player-layout').innerHTML,/id="player-total-remaining">15:40<\/b>/);
});

test('Food detail modal offers exact portion preset for remaining daily protein and updates nutrition table live',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'n1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'267'}]}]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="detail-preset-grams" data-id="chicken" data-grams="178" aria-pressed="false">✓ 40 г протеин \(178 г\)/);

 app.click({dataset:{action:'detail-preset-grams',id:'chicken',grams:'178'}});
 assert.equal(app.node('detail-grams').value,'178');
 assert.match(app.node('detail-table').innerHTML,/<th>178 г<\/th>/);
});

test('Saved meals empty state offers 1-tap starter pack and renders overview summary and macro calorie split',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/data-action="seed-saved-starters">\+ Запази 3 базови хранения/);

 app.click({dataset:{action:'seed-saved-starters'}});
 assert.equal(JSON.parse(app.storage['forme-saved-meals']).length,3);
 assert.match(app.page(),/plan-summary[\s\S]*<strong>♡ 3<\/strong><span>Средно:/);
 assert.match(app.page(),/saved-macro-split">Протеин \d+% · Въглехидрати \d+% · Мазнини \d+%/);
});

test('Exercise catalog offers 1-tap personal records filter (toggle-ex-pr) and resets cleanly',()=>{
 const app=boot('#exercises',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'s1',exerciseId:'Pushups',kind:'reps',value:20,date:'2026-11-09'},{id:'s2',exerciseId:'Plank',kind:'seconds',value:60,date:'2026-11-09'}]})
 },new Date(2026,10,9,12));
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-pr" aria-pressed="false">★ Лични рекорди \(2\)/);

 app.click({dataset:{action:'toggle-ex-pr'}});
 assert.match(app.node('exercise-results').innerHTML,/Намерени 2 от 49 упражнения/);
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-pr" aria-pressed="true">★ Лични рекорди \(2\)/);

 app.click({dataset:{action:'reset-filters',group:'exercises'}});
 assert.match(app.node('exercise-results').innerHTML,/Намерени 49 от 49 упражнения/);
});

test('Nutrition journal surfaces top logged foods with recent grams for 1-tap quick logging',()=>{
 const core=require('./core.js');
 const top=core.topLoggedFoods([
  {date:'2026-11-07',items:[{id:'oats',grams:'70'},{id:'chicken',grams:'200'}]},
  {date:'2026-11-08',items:[{id:'oats',grams:'80'}]}
 ],3);
 assert.deepEqual(top,[{id:'oats',count:2,grams:'80'},{id:'chicken',count:1,grams:'200'}]);

 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[
   {id:'n1',date:'2026-11-07',name:'Закуска',items:[{id:'oats',grams:'70'}]},
   {id:'n2',date:'2026-11-08',name:'Закуска',items:[{id:'oats',grams:'80'}]}
  ]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/journal-frequent-foods[\s\S]*data-action="journal-log-frequent" data-id="oats" data-grams="80">\+ Овесени ядки \(80 г\)/);

 app.click({dataset:{action:'journal-log-frequent',id:'oats',grams:'80'}});
 const todayEntries=JSON.parse(app.storage['forme-nutrition-v1']).entries.filter(e=>e.date==='2026-11-09');
 assert.equal(todayEntries.length,1);
 assert.deepEqual(todayEntries[0].items,[{id:'oats',grams:'80'}]);
});

test('Meal builder shows per-item calorie share (%) on multi-item plates and favorites all plate foods in 1 tap',()=>{
 const app=boot('#nutrition',{
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'100'},{id:'rice',grams:'100'}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/id="meal-item-meta-0"[^>]*>120 kcal · 22,5 г протеин · 48% kcal/);
 assert.match(app.page(),/id="meal-item-meta-1"[^>]*>130 kcal · 2,7 г протеин · 52% kcal/);
 assert.match(app.page(),/data-action="meal-fav-foods">♥ Запази всички в любими/);

 app.click({dataset:{action:'meal-fav-foods'}});
 assert.deepEqual(JSON.parse(app.storage['forme-favorites']).foods,['chicken','rice']);
 assert.doesNotMatch(app.page(),/data-action="meal-fav-foods"/);
});

test('Progress lifetime summary computes and displays all-time longest workout streak even after a break',()=>{
 const core=require('./core.js');
 assert.equal(core.longestWorkoutStreak(['2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-11-08']),4);

 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sets:[],
   sessions:[
    {id:'w1',workoutId:'mob-daily',date:'2026-10-01',minutes:10},
    {id:'w2',workoutId:'mob-daily',date:'2026-10-02',minutes:10},
    {id:'w3',workoutId:'mob-daily',date:'2026-10-03',minutes:10},
    {id:'w4',workoutId:'mob-daily',date:'2026-10-04',minutes:10}
   ]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/progress-lifetime[\s\S]*🔥 Най-дълга серия: 4 дни/);
});

test('Month calendar displays planned and logged monthly minutes and copies a workout to +1 day in 1 tap',()=>{
 const app=boot('#plan',{
  'forme-plan':JSON.stringify({mon:'cal-start'}),
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sets:[],sessions:[{id:'w1',workoutId:'cal-start',date:'2026-11-02',minutes:15}]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'plan-view',view:'month'}});
 assert.match(app.page(),/plan-summary"><strong>5 \/ 30<\/strong><span>с планирана тренировка · 60 мин · ✓ 1 \(15 мин\)<\/span>/);

 app.click({dataset:{action:'plan-date',date:'9'}});
 assert.match(app.page(),/data-action="copy-date-next-day" data-id="cal-start" data-date="2026-11-10">\+ След 1 ден/);
 app.click({dataset:{action:'copy-date-next-day',id:'cal-start',date:'2026-11-10'}});
 assert.equal(JSON.parse(app.storage['forme-date-plans'])['2026-11-10'],'cal-start');
});

test('Backup restore and merge toasts include validated archive record counts via summarizeArchive',async()=>{
 const app=boot('#progress',{},new Date(2026,10,9,12));
 const archive=JSON.stringify({
  app:'FORME',version:1,exportedAt:'2026-11-09T12:00:00.000Z',
  data:{
   'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:12}],sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:45}]}),
   'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'n1',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'150'}]}]})
  }
 });
 app.change({id:'backup-merge-file',value:'archive.json',files:[{text:()=>Promise.resolve(archive)}]});
 await Promise.resolve();
 assert.match(app.toast(),/Архивът е обединен с текущите данни\. \(1 тренировки, 1 · Серии, 1 · Дневник\)/);
});

test('Workouts catalog offers a 1-tap completed workouts filter (toggle-wk-done) and clears it via reset-filters',()=>{
 const app=boot('#sessions',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:12},{id:'s2',workoutId:'mob-daily',date:'2026-11-08',minutes:10}],sets:[]})},new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/data-action="toggle-wk-done" aria-pressed="false">✓ Изпълнени \(2\)/);
 app.click({dataset:{action:'toggle-wk-done'}});
 assert.match(app.node('workout-results').innerHTML,/Намерени 2 от 6 тренировки/);
 assert.match(app.node('workout-results').innerHTML,/data-action="toggle-wk-done" aria-pressed="true"/);
 app.click({dataset:{action:'reset-filters',group:'workouts'}});
 assert.match(app.node('workout-results').innerHTML,/Намерени 6 от 6 тренировки/);
});

test('Workout player round strip buttons jump directly to any exercise before or during a workout',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 assert.match(app.node('player-layout').innerHTML,/data-action="select-player-step" data-step="2"/);
 app.click({dataset:{action:'select-player-step',step:'2'}});
 assert.match(app.node('player-layout').innerHTML,/УПРАЖНЕНИЕ 3 \/ 12[\s\S]*<h2>Планк<\/h2>/);
 app.click({dataset:{action:'player-start'}});
 app.click({dataset:{action:'select-player-step',step:'1'}});
 assert.match(app.node('player-layout').innerHTML,/УПРАЖНЕНИЕ 2 \/ 12[\s\S]*РАБОТА[\s\S]*<h2>Лицеви опори<\/h2>/);
});

test('Nutrition journal surfaces all-time longest nutrition logging streak even when current streak is broken',()=>{
 const app=boot('#nutrition',{'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:120},entries:[{id:'e1',date:'2026-10-10',name:'З',items:[{id:'oats',grams:'80'}]},{id:'e2',date:'2026-10-11',name:'З',items:[{id:'oats',grams:'80'}]},{id:'e3',date:'2026-10-12',name:'З',items:[{id:'oats',grams:'80'}]},{id:'e4',date:'2026-10-13',name:'З',items:[{id:'oats',grams:'80'}]}]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/🔥 Най-дълга серия: 4 дни/);
});

test('Food detail modal offers -25 / +25g stepper buttons (detail-step-grams) that recalculate macros live',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="detail-step-grams" data-id="chicken" data-delta="25"/);
 app.click({dataset:{action:'detail-step-grams',id:'chicken',delta:'25'}});
 assert.equal(app.node('detail-grams').value,'125');
 assert.match(app.node('detail-table').innerHTML,/<th>125 г<\/th>[\s\S]*150 kcal/);
 app.click({dataset:{action:'detail-step-grams',id:'chicken',delta:'-25'}});
 assert.equal(app.node('detail-grams').value,'100');
});

test('Saved meals offer non-destructive + Хранене (append-saved-meal) that merges ingredients onto the active plate',()=>{
 const app=boot('#nutrition',{
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'100'}]),
  'forme-saved-meals':JSON.stringify([{name:'Обяд',items:[{id:'chicken',grams:'150'},{id:'rice',grams:'120'}]}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/data-action="append-saved-meal" data-index="0"/);
 app.click({dataset:{action:'append-saved-meal',index:'0'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'chicken',grams:'250'},{id:'rice',grams:'120'}]);
 assert.match(app.page(),/Сглоби хранене \(2\)/);
});

test('Favorites page distributes 2+ favorite workouts evenly across the weekly plan in 1 tap and shows exercise PR count',()=>{
 const app=boot('#favorites',{
  'forme-favorites':JSON.stringify({workouts:['cal-start','yoga-reset','mob-daily'],exercises:['Plank','Pushups']}),
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:45}]})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/2 упражнения \(★ 1\)/);
 assert.match(app.page(),/data-action="favorites-to-plan"/);
 app.click({dataset:{action:'favorites-to-plan'}});
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{mon:'cal-start',wed:'yoga-reset',fri:'mob-daily'});
 assert.match(app.page(),/3 от 7 дни/);
});

test('Progress set logger offers 1-tap progressive overload button (beat-set-pr) above personal best',()=>{
 const app=boot('#progress',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'st1',exerciseId:'Plank',date:'2026-11-08',kind:'seconds',value:45},{id:'st2',exerciseId:'Pushups',date:'2026-11-08',kind:'reps',value:15}]})},new Date(2026,10,9,12));
 app.change({id:'set-exercise',value:'Plank'});
 assert.match(app.node('set-best-actions').innerHTML,/data-action="beat-set-pr" data-kind="seconds" data-value="50">★ \+5 \(50 секунди\)/);
 app.click({dataset:{action:'beat-set-pr',kind:'seconds',value:'50'}});
 assert.equal(app.node('set-value').value,'50');
 app.change({id:'set-exercise',value:'Pushups'});
 assert.match(app.node('set-best-actions').innerHTML,/data-action="beat-set-pr" data-kind="reps" data-value="16">★ \+1 \(16 повторения\)/);
});

test('Exercises catalog exposes a 1-tap bodyweight filter toggle (toggle-ex-none) synced with equipment select',()=>{
 const app=boot('#exercises',{},new Date(2026,10,9,12));
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-none" aria-pressed="false">Без оборудване \(\d+\)/);
 app.click({dataset:{action:'toggle-ex-none'}});
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-none" aria-pressed="true"/);
 assert.doesNotMatch(app.node('exercise-results').innerHTML,/data-id="Pullups"/);
 assert.match(app.node('exercise-results').innerHTML,/data-id="Pushups"/);
 app.click({dataset:{action:'toggle-ex-none'}});
 assert.match(app.node('exercise-results').innerHTML,/Намерени 49 от 49 упражнения/);
});

test('Weekly plan surfaces completed workouts across all 7 days of the current week and in plan-summary',()=>{
 // 2026-11-11 is Wednesday; Monday 2026-11-09 was completed
 const app=boot('#plan',{
  'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset',fri:'mob-daily'}),
  'forme-completed-workouts':JSON.stringify({'2026-11-09':{id:'cal-start',name:'Силна основа'}})
 },new Date(2026,10,11,12));
 assert.match(app.page(),/plan-summary"><strong>3 от 7 дни<\/strong><span>[^<]*· ✓ 1<\/span>/);
 assert.match(app.page(),/day-label">ПОН<\/div>[\s\S]*✓ Отбелязана като изпълнена: Силна основа/);
});

test('Home overview offers 1-tap saved meal quick-logging when today has 0 kcal and shows remaining daily targets once logged',()=>{
 const app=boot('#home',{
  'forme-saved-meals':JSON.stringify([{name:'Закуска',items:[{id:'chicken',grams:'200'}]}]),
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[]})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="log-saved-meal" data-index="0"[^>]*>\+ ♡ Закуска/);
 app.click({dataset:{action:'log-saved-meal',index:'0'}});
 assert.equal(JSON.parse(app.storage['forme-nutrition-v1']).entries.length,1);
 app.click({dataset:{action:'nav',page:'home'}});
 assert.doesNotMatch(app.page(),/data-action="log-saved-meal"/);
 assert.match(app.page(),/home-remaining">Остават до целта: <strong>1[\s\u00a0]?760 kcal<\/strong> · <strong>55 г протеин<\/strong>/);
});

test('Meal builder add-food picker supports -25 / +25 g stepper buttons and syncs portion presets',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/data-action="meal-step-grams" data-delta="-25"/);
 app.node('meal-food-grams').value='100';
 app.node('meal-food-select').value='chicken';
 app.click({dataset:{action:'meal-step-grams',delta:'-25'}});
 assert.equal(app.node('meal-food-grams').value,'75');
 app.click({dataset:{action:'meal-step-grams',delta:'25'}});
 app.click({dataset:{action:'meal-step-grams',delta:'50'}});
 assert.equal(app.node('meal-food-grams').value,'150');
 assert.match(app.node('meal-presets').innerHTML,/data-grams="150" aria-pressed="true"/);
});

test('Foods catalog offers 1-tap high-protein filter (≥15 g) and clears with reset-filters',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 assert.match(app.node('food-results').innerHTML,/data-action="toggle-food-protein" aria-pressed="false">Протеин ≥15 г \(7\)/);
 app.click({dataset:{action:'toggle-food-protein'}});
 assert.match(app.node('food-results').innerHTML,/Намерени 7 от 30 храни/);
 assert.match(app.node('food-results').innerHTML,/data-action="toggle-food-protein" aria-pressed="true"/);
 app.click({dataset:{action:'reset-filters',group:'foods'}});
 assert.match(app.node('food-results').innerHTML,/Намерени 30 от 30 храни/);
});

test('Exercise detail inline set logger offers 1-tap progressive overload button above personal best',()=>{
 const app=boot('#exercises',{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'st-1',exerciseId:'Pushups',date:'2026-11-05',kind:'reps',value:14}]})},new Date(2026,10,9,12));
 app.click({dataset:{action:'exercise-detail',id:'Pushups'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="detail-beat-pr" data-value="15">★ \+1 \(15 повторения\)/);
 app.click({dataset:{action:'detail-beat-pr',value:'15'}});
 assert.equal(app.node('detail-set-value').value,'15');
 app.click({dataset:{action:'detail-save-set',id:'Pushups',kind:'reps'}});
 assert.match(app.node('modal-root').innerHTML,/data-action="detail-beat-pr" data-value="16">★ \+1 \(16 повторения\)/);
});

test('Workouts catalog offers 1-tap bodyweight filter (Без оборудване) bidirectionally synced with equipment select',()=>{
 const app=boot('#sessions',{},new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/data-action="toggle-wk-none" aria-pressed="false">Без оборудване \(2\)/);
 app.click({dataset:{action:'toggle-wk-none'}});
 assert.match(app.node('workout-results').innerHTML,/Намерени 2 от 6 тренировки/);
 assert.match(app.node('workout-results').innerHTML,/data-action="toggle-wk-none" aria-pressed="true"/);
 assert.equal(app.node('workouts-equip').value,'none');
 app.click({dataset:{action:'reset-filters',group:'workouts'}});
 assert.match(app.node('workout-results').innerHTML,/Намерени 6 от 6 тренировки/);
});

test('Nutrition journal entries support non-destructive + Хранене (journal-append-meal) merging onto current plate',()=>{
 const app=boot('#nutrition',{
  'forme-current-meal':JSON.stringify([{id:'oats',grams:'60'}]),
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'e1',date:'2026-11-09',name:'Закуска',items:[{id:'oats',grams:'40'},{id:'banana',grams:'100'}]}]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-append-meal" data-id="e1"/);
 app.click({dataset:{action:'journal-append-meal',id:'e1'}});
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'oats',grams:'100'},{id:'banana',grams:'100'}]);
});

test('Weekly plan offers 1-tap past-weekday workout logging (month-log-workout) with exact date prefilled',()=>{
 const app=boot('#plan',{
  'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset'})
 },new Date(2026,10,11,12));
 assert.match(app.page(),/data-action="month-log-workout" data-id="cal-start" data-date="2026-11-09"/);
 app.click({dataset:{action:'month-log-workout',id:'cal-start',date:'2026-11-09'}});
 assert.match(app.page(),/id="log-workout-date" type="date" value="2026-11-09"/);
 assert.match(app.page(),/<option value="cal-start" selected>/);
});

test('Workout player surfaces personal best during active exercise and on post-workout exercise chips',()=>{
 const app=boot('#sessions',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'st-1',exerciseId:'Pushups',date:'2026-11-05',kind:'reps',value:18}]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 app.click({dataset:{action:'set-player-rounds',rounds:'1'}});
 app.click({dataset:{action:'select-player-step',step:'1'}});
 assert.match(app.node('player-layout').innerHTML,/player-best-hint">★ Личен рекорд: 18 повторения/);
 app.click({dataset:{action:'player-start'}});
 for(let i=0;i<20;i++){
  if(/player-done-exercises/.test(app.node('player-layout').innerHTML))break;
  app.click({dataset:{action:'player-next'}});
 }
 assert.match(app.node('player-layout').innerHTML,/data-action="exercise-log-set" data-id="Pushups"[^>]*>\+ Лицеви опори \(★ 18\)/);
});

test('Favorites page saves 2+ favorite foods directly as a reusable saved meal template (favorites-save-meal)',()=>{
 const app=boot('#favorites',{
  'forme-favorites':JSON.stringify({workouts:[],exercises:[],foods:['chicken','rice','broccoli']})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="favorites-save-meal">♡ Запази храненето/);
 app.click({dataset:{action:'favorites-save-meal'}});
 assert.deepEqual(JSON.parse(app.storage['forme-saved-meals']),[{name:'Любими храни',items:[{id:'chicken',grams:'100'},{id:'rice',grams:'100'},{id:'broccoli',grams:'100'}]}]);
 assert.match(app.page(),/Любими храни/);
});

test('C.compareWeeks and Progress weekly stat cards display positive week-over-week growth vs previous week',()=>{
 const core=require('./core.js');
 assert.equal(core.compareWeeks({workouts:2,minutes:40,sets:3},{workouts:0,minutes:0,sets:0}),null);
 assert.deepEqual(core.compareWeeks({workouts:3,minutes:65,sets:5},{workouts:1,minutes:20,sets:2}),{workoutsDelta:2,minutesDelta:45,setsDelta:3});
 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[
    {id:'s-prev',workoutId:'mob-daily',date:'2026-11-03',minutes:10},
    {id:'s-1',workoutId:'cal-start',date:'2026-11-09',minutes:20},
    {id:'s-2',workoutId:'yoga-reset',date:'2026-11-10',minutes:15}
   ],
   sets:[
    {id:'st-prev',exerciseId:'Plank',date:'2026-11-03',kind:'seconds',value:30},
    {id:'st-1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:40},
    {id:'st-2',exerciseId:'Pushups',date:'2026-11-10',kind:'reps',value:12}
   ]
  })
 },new Date(2026,10,11,12));
 assert.match(app.page(),/тренировки · ↑ \+1/);
 assert.match(app.page(),/записани минути · ↑ \+25/);
 assert.match(app.page(),/тази седмица · ↑ \+1/);
});

test('Meal builder picker displays live kcal/protein/fiber preview (#meal-pick-preview) before adding',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/id="meal-pick-preview">120 kcal · 22,5 г протеин/);
 app.node('meal-food-grams').value='100';
 app.change({id:'meal-food-select',value:'oats'});
 assert.match(app.node('meal-pick-preview').textContent,/379 kcal · 13,2 г протеин · 10,1 г фибри/);
 app.node('meal-food-select').value='oats';
 app.click({dataset:{action:'meal-preset-grams',grams:'200'}});
 assert.match(app.node('meal-pick-preview').textContent,/758 kcal · 26,3 г протеин · 20,2 г фибри/);
});

test('Foods catalog offers 1-tap Фибри ≥5 г quick filter toggle combinable with Протеин ≥15 г',()=>{
 const app=boot('#nutrition',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.node('food-results').innerHTML,/data-action="toggle-food-fiber" aria-pressed="false">Фибри ≥5 г \(8\)/);
 app.click({dataset:{action:'toggle-food-fiber'}});
 assert.match(app.node('food-results').innerHTML,/data-action="toggle-food-fiber" aria-pressed="true"/);
 assert.match(app.node('food-results').innerHTML,/Намерени 8 от 30 храни/);
 app.click({dataset:{action:'toggle-food-protein'}});
 assert.match(app.node('food-results').innerHTML,/Намерени 3 от 30 храни/);
 app.click({dataset:{action:'reset-filters',group:'foods'}});
 assert.match(app.node('food-results').innerHTML,/Намерени 30 от 30 храни/);
});

test('Meal builder shows daily fibre goal share in mealTotals and logs selected picker food directly to journal without altering plate',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-current-meal':JSON.stringify([{id:'oats',grams:'100'}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/meal-goal-share[\s\S]*19% kcal · 13% протеин · 40% фибри/);
 app.node('meal-food-select').value='banana';
 app.node('meal-food-grams').value='150';
 app.click({dataset:{action:'log-selected-food'}});
 assert.equal(app.toast(),'Записът е запазен.');
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[{id:'oats',grams:'100'}]);
 const entries=JSON.parse(app.storage['forme-nutrition-v1']).entries;
 assert.equal(entries.length,1);
 assert.deepEqual(entries[0].items,[{id:'banana',grams:'150'}]);
});

test('Exercises catalog offers 1-tap Начинаещ quick filter toggle bidirectionally synced with #exercises-level',()=>{
 const app=boot('#exercises',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-beginner" aria-pressed="false">Начинаещ \(22\)/);
 app.click({dataset:{action:'toggle-ex-beginner'}});
 assert.equal(app.node('exercises-level').value,'beginner');
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-beginner" aria-pressed="true"/);
 assert.match(app.node('exercise-results').innerHTML,/Намерени 22 от 49 упражнения/);
 app.input({dataset:{filter:'exercises',key:'level'},value:'advanced'});
 assert.match(app.node('exercise-results').innerHTML,/data-action="toggle-ex-beginner" aria-pressed="false"/);
 app.click({dataset:{action:'reset-filters',group:'exercises'}});
 assert.match(app.page(),/id="exercises-level"[\s\S]*?<option value="" selected>/);
 assert.match(app.node('exercise-results').innerHTML,/Намерени 49 от 49 упражнения/);
});

test('Workouts catalog offers 1-tap До 12 мин quick-session filter toggle bidirectionally synced with #workouts-maxTime',()=>{
 const app=boot('#sessions',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/data-action="toggle-wk-short" aria-pressed="false">До 12 мин \(3\)/);
 app.click({dataset:{action:'toggle-wk-short'}});
 assert.equal(app.node('workouts-maxTime').value,'12');
 assert.match(app.node('workout-results').innerHTML,/data-action="toggle-wk-short" aria-pressed="true"/);
 assert.match(app.node('workout-results').innerHTML,/Намерени 3 от 6 тренировки/);
 app.click({dataset:{action:'toggle-wk-none'}});
 assert.match(app.node('workout-results').innerHTML,/Намерени 2 от 6 тренировки/);
 app.click({dataset:{action:'reset-filters',group:'workouts'}});
 assert.match(app.page(),/id="workouts-maxTime"[\s\S]*?<option value="" selected>/);
 assert.match(app.node('workout-results').innerHTML,/Намерени 6 от 6 тренировки/);
});

test('Saved meal cards display daily kcal/protein goal share and offer 1-tap favorite-all-ingredients (saved-fav-foods)',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-saved-meals':JSON.stringify([{name:'След тренировка',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/saved-goal-share">22% kcal · 49% протеин/);
 assert.match(app.page(),/data-action="saved-fav-foods" data-index="0"/);
 app.click({dataset:{action:'saved-fav-foods',index:'0'}});
 assert.deepEqual(JSON.parse(app.storage['forme-favorites']).foods,['chicken','rice']);
 assert.doesNotMatch(app.page(),/data-action="saved-fav-foods"/);
});

test('Weekly plan weekday cards surface active date-only overrides (day-date-override) with 1-tap reset to weekly schedule',()=>{
 const app=boot('#plan',{
  'forme-language':'bg',
  'forme-plan':JSON.stringify({mon:'cal-start'}),
  'forme-date-plans':JSON.stringify({'2026-11-10':'yoga-reset','2026-11-11':''})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/day-date-override">Избор само за тази дата: <strong>Спокойно възстановяване<\/strong>[\s\S]*?data-action="week-reset-date-plan" data-date="2026-11-10"/);
 assert.match(app.page(),/day-date-override">Избор само за тази дата: <strong>Почивка<\/strong>[\s\S]*?data-action="week-reset-date-plan" data-date="2026-11-11"/);
 app.click({dataset:{action:'week-reset-date-plan',date:'2026-11-10'}});
 assert.deepEqual(JSON.parse(app.storage['forme-date-plans']),{'2026-11-11':''});
 assert.doesNotMatch(app.page(),/data-date="2026-11-10"/);
});

test('Progress manual workout logger offers -5 / +5 min steppers and 10–30 min quick duration presets',()=>{
 const app=boot('#progress',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="step-workout-minutes" data-delta="-5"/);
 assert.match(app.page(),/data-action="preset-workout-minutes" data-minutes="20"/);
 app.node('log-workout-minutes').value='12';
 app.click({dataset:{action:'step-workout-minutes',delta:'5'}});
 assert.equal(app.node('log-workout-minutes').value,'17');
 app.click({dataset:{action:'step-workout-minutes',delta:'-5'}});
 app.click({dataset:{action:'step-workout-minutes',delta:'-5'}});
 app.click({dataset:{action:'step-workout-minutes',delta:'-5'}});
 app.click({dataset:{action:'step-workout-minutes',delta:'-5'}});
 assert.equal(app.node('log-workout-minutes').value,'1');
 app.click({dataset:{action:'preset-workout-minutes',minutes:'30'}});
 assert.equal(app.node('log-workout-minutes').value,'30');
 app.node('log-workout-id').value='cal-start';
 app.node('log-workout-date').value='2026-11-09';
 app.click({dataset:{action:'progress-workout'}});
 assert.equal(JSON.parse(app.storage['forme-progress-v1']).sessions[0].minutes,30);
});

test('Nutrition journal shows per-entry % kcal share when multiple meals logged and offers 1-tap favorite all day foods',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-nutrition-v1':JSON.stringify({
   version:1,goal:{kcal:2000,protein:100},
   entries:[
    {id:'j1',date:'2026-11-09',name:'Закуска',items:[{id:'chicken',grams:'100'}]},
    {id:'j2',date:'2026-11-09',name:'Вечеря',items:[{id:'chicken',grams:'300'}]}
   ]
  })
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/120 kcal · 22,5 г протеин · 25% kcal/);
 assert.match(app.page(),/360 kcal · 67,5 г протеин · 75% kcal/);
 assert.match(app.page(),/data-action="journal-day-fav-foods"/);
 app.click({dataset:{action:'journal-day-fav-foods'}});
 assert.deepEqual(JSON.parse(app.storage['forme-favorites']).foods,['chicken']);
 assert.doesNotMatch(app.page(),/data-action="journal-day-fav-foods"/);
});

test('Favorites screen offers live multilingual search (#favorites-search) with / focus and Escape clear',()=>{
 const app=boot('#favorites',{
  'forme-language':'bg',
  'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank','Pushups'],foods:['oats']})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/id="favorites-search"/);
 let focused=false;
 app.node('favorites-search').focus=()=>{focused=true;};
 app.keydown({key:'/',target:{tagName:'BODY'},preventDefault(){}});
 assert.equal(focused,true);
 app.input({dataset:{action:'favorites-search'},value:'push'});
 assert.match(app.node('favorites-results').innerHTML,/Лицеви опори/);
 assert.doesNotMatch(app.node('favorites-results').innerHTML,/Силна основа/);
 assert.doesNotMatch(app.node('favorites-results').innerHTML,/Овесени ядки/);
 const inp=app.node('favorites-search');
 inp.dataset={action:'favorites-search'};
 inp.value='push';
 app.keydown({key:'Escape',target:inp,preventDefault(){}});
 assert.equal(inp.value,'');
 assert.match(app.node('favorites-results').innerHTML,/Силна основа/);
 assert.match(app.node('favorites-results').innerHTML,/Овесени ядки/);
});

test('Home overview shows remaining weekly workouts/minutes (.home-workout-status) and weekly goal achieved badge',()=>{
 const partial=boot('#home',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:60},
   sessions:[{id:'s1',date:'2026-11-09',workoutId:'cal-start',name:'Силна основа',minutes:20}],
   sets:[]
  })
 },new Date(2026,10,9,12));
 assert.match(partial.page(),/home-workout-status">Остават за седмицата: <strong>2 тренировки<\/strong> · <strong>40 мин<\/strong>/);
 const done=boot('#home',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:2,minutesPerWeek:40},
   sessions:[
    {id:'s1',date:'2026-11-09',workoutId:'cal-start',name:'Силна основа',minutes:25},
    {id:'s2',date:'2026-11-09',workoutId:'mob-daily',name:'Движение без схващане',minutes:20}
   ],
   sets:[]
  })
 },new Date(2026,10,9,12));
 assert.match(done.page(),/home-workout-status">✓ Седмичната цел е изпълнена/);
});










































































test('Progress shows the weekday split of logged workouts with the most active day highlighted',()=>{
 const core=require('./core.js');
 const split=core.weekdayActivity([
  {date:'2026-11-09',minutes:20},{date:'2026-11-09',minutes:10},{date:'2026-11-11',minutes:25},{date:'2026-11-14',minutes:5},{date:'bad',minutes:9},null
 ],['mon','tue','wed','thu','fri','sat','sun']);
 assert.equal(split.top,'mon');assert.equal(split.topWorkouts,2);assert.equal(split.totalWorkouts,4);assert.equal(split.totalMinutes,60);
 assert.deepEqual(split.days.map(d=>d.workouts),[2,0,1,0,0,1,0]);

 const app=boot('#progress',{
  'forme-progress-v1':JSON.stringify({
   version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sets:[],
   sessions:[
    {id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:20},
    {id:'s2',workoutId:'mob-daily',date:'2026-11-09',minutes:10},
    {id:'s3',workoutId:'yoga-reset',date:'2026-11-11',minutes:25}
   ]
  })
 },new Date(2026,10,9,12));
 assert.match(app.page(),/progress-weekdays[\s\S]*Разпределение по дни/);
 assert.match(app.page(),/weekday-bar-top[\s\S]*ПОН/);
 assert.match(app.page(),/progress-top-day">Най-активен ден: <strong>ПОН<\/strong> · 2 тренировки/);
 assert.match(app.page(),/aria-label="ПОН: 2 тренировки · 30 мин"/);
});
test('Favorites offers 1-tap section filters and keeps the search query across views',()=>{
 const app=boot('#favorites',{
  'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank','Pullups'],foods:['oats']})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="favorites-filter" data-view="all" aria-pressed="true">Всички \(4\)/);
 assert.match(app.page(),/data-action="favorites-filter" data-view="exercises" aria-pressed="false">Упражнения \(2\)/);
 assert.match(app.page(),/data-action="favorites-filter" data-view="foods" aria-pressed="false">Храни \(1\)/);

 app.click({dataset:{action:'favorites-filter',view:'exercises'}});
 assert.match(app.page(),/data-action="favorites-filter" data-view="exercises" aria-pressed="true"/);
 const section=()=>app.page().slice(app.page().indexOf('id="favorites-results"'));
 assert.match(section(),/Любими упражнения/);
 assert.doesNotMatch(section(),/Любими тренировки|Любими храни/);
 assert.match(section(),/data-action="exercise-detail" data-id="Plank"/);

 app.click({dataset:{action:'favorites-filter',view:'foods'}});
 assert.match(section(),/Овесени ядки/);
 assert.doesNotMatch(section(),/Любими тренировки|Любими упражнения/);

 app.click({dataset:{action:'favorites-filter',view:'all'}});
 const all=section();
 assert.match(all,/Силна основа/);assert.match(all,/Планк/);assert.match(all,/Овесени ядки/);
});
test('Nutrition journal shows the weekly logging progress (active days out of 7) once any day is logged',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[
   {id:'a',date:'2026-11-09',name:'Закуска',items:[{id:'oats',grams:'80'}]},
   {id:'b',date:'2026-11-10',name:'Обяд',items:[{id:'chicken',grams:'200'}]},
   {id:'c',date:'2026-11-08',name:'Предишния ден',items:[{id:'rice',grams:'100'}]},
   {id:'d',date:'2026-10-20',name:'Извън прозореца',items:[{id:'rice',grams:'100'}]}
  ]})
 },new Date(2026,10,10,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 const page=app.page();
 assert.match(page,/journal-week-progress">Напредък за седмицата: <strong>3\/7 активни дни<\/strong> · 43%/);
 assert.match(page,/journal-week-summary[\s\S]*Средно за активните дни \(3\/7\)/);
 assert.match(page,/journal-week-progress[\s\S]*goal-meter[\s\S]*width:43%/);
});
test('The player offers a 1-tap skip-rest action only during rest and jumps straight to the next exercise',()=>{
 const app=boot('#sessions',{});
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 assert.doesNotMatch(app.node('player-layout').innerHTML,/data-action="player-skip-rest"/);
 app.click({dataset:{action:'player-start'}});
 assert.doesNotMatch(app.node('player-layout').innerHTML,/data-action="player-skip-rest"/);

 app.click({dataset:{action:'player-next'}});
 const during=app.node('player-layout').innerHTML;
 assert.match(during,/data-action="player-skip-rest">⏭ Пропусни почивката/);

 app.click({dataset:{action:'player-skip-rest'}});
 const after=app.node('player-layout').innerHTML;
 assert.doesNotMatch(after,/data-action="player-skip-rest"/);
 assert.doesNotMatch(after,/undefined/);
 assert.match(after,/data-action="player-pause"|data-action="player-resume"/);

 app.click({dataset:{action:'player-start'}});
});
test('Pressing S during rest skips the break, the legend and shortcut dialog list it, and S does nothing during work',()=>{
 const app=boot('#sessions',{});
 app.click({dataset:{action:'start-workout',id:'cal-start'}});
 app.click({dataset:{action:'player-start'}});
 assert.match(app.node('player-layout').innerHTML,/S пропусни почивката/);

 const key=k=>({key:k,preventDefault(){},target:{tagName:'BODY'}});
 app.keydown(key('s'));
 assert.doesNotMatch(app.node('player-layout').innerHTML,/data-action="player-skip-rest"/);

 app.click({dataset:{action:'player-next'}});
 assert.match(app.node('player-layout').innerHTML,/data-action="player-skip-rest"/);
 app.keydown(key('S'));
 const after=app.node('player-layout').innerHTML;
 assert.doesNotMatch(after,/data-action="player-skip-rest"/);
 assert.doesNotMatch(after,/undefined/);

 app.click({dataset:{action:'open-shortcuts'}});
 assert.match(app.node('modal-root').innerHTML,/shortcuts.skipRest|<kbd class="kbd">S<\/kbd>/);
});
test('Progress set form offers a 1-tap "today" date button and remembers the chosen date across re-renders',()=>{
 const app=boot('#progress',{},new Date(2026,10,15,12));
 assert.match(app.page(),/data-action="set-date-today" aria-label="Задай днешна дата">Днес/);
 const input=app.node('set-date');
 input.value='2026-11-02';
 app.change({id:'set-date',value:'2026-11-02'});
 app.click({dataset:{action:'set-date-today'}});
 assert.equal(input.value,'2026-11-15');
 assert.match(app.toast(),/Дата: 2026-11-15/);

 app.click({dataset:{action:'nav',page:'home'}});
 app.click({dataset:{action:'nav',page:'progress'}});
 assert.equal(app.node('set-date').value,'2026-11-15');
});
test('Progress workout logger offers the same 1-tap today date button',()=>{
 const app=boot('#progress',{},new Date(2026,10,20,12));
 assert.match(app.page(),/data-action="log-workout-date-today" aria-label="Задай днешна дата">Днес/);
 app.node('log-workout-date').value='2026-10-01';
 app.click({dataset:{action:'log-workout-date-today'}});
 assert.equal(app.node('log-workout-date').value,'2026-11-20');
 assert.match(app.toast(),/2026-11-20/);
});
test('Nutrition journal marks today in the 7-day strip while keeping dates for other days',()=>{
 const app=boot('#nutrition',{},new Date(2026,10,12,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 const page=app.page();
 assert.match(page,/data-date="2026-11-12"[^>]*><small>Днес<\/small>/);
 assert.match(page,/data-date="2026-11-11"[^>]*><small>11-11<\/small>/);
 assert.doesNotMatch(page,/data-action="journal-today">Днес/);

 app.click({dataset:{action:'journal-step-date',offset:'-1'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-11"/);
 assert.match(app.page(),/data-date="2026-11-11"[^>]*><small>11-11<\/small>/);
 assert.doesNotMatch(app.page(),/data-date="2026-11-12"/);
 assert.match(app.page(),/data-action="journal-today">Днес/);

 app.click({dataset:{action:'journal-today'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-12"/);
});
test('Workout cards show the last logged date next to the completion counter',()=>{
 const app=boot('#sessions',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sets:[],sessions:[
   {id:'s1',workoutId:'cal-start',date:'2026-10-28',minutes:20},
   {id:'s2',workoutId:'cal-start',date:'2026-11-04',minutes:22},
   {id:'s3',workoutId:'mob-daily',date:'2026-11-01',minutes:10}
  ]})
 },new Date(2026,10,9,12));
 const results=app.node('workout-results').innerHTML;
 assert.match(results,/✓ 2×[\s\S]*?class="chip">Последно 11-04<\/span>/);
 assert.match(results,/class="chip">Последно 11-01<\/span>/);
});
test('Nutrition journal offers 1-tap "save day" that stores the whole day as a single merged saved meal',()=>{
 const app=boot('#nutrition',{
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[
   {id:'a',date:'2026-11-09',name:'Закуска',items:[{id:'oats',grams:'80'}]},
   {id:'b',date:'2026-11-09',name:'Обяд',items:[{id:'chicken',grams:'200'},{id:'oats',grams:'20'}]}
  ]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-save-day-meal" aria-label="Запази деня">♡ Запази деня/);

 app.click({dataset:{action:'journal-save-day-meal'}});
 const saved=JSON.parse(app.storage['forme-saved-meals']);
 assert.equal(saved.length,1);
 assert.equal(saved[0].name,'Ден 2026-11-09');
 assert.deepEqual(saved[0].items.map(x=>[x.id,x.grams]),[['oats','100'],['chicken','200']]);
 assert.match(app.toast(),/Храненето е запазено/);

 // a second click keeps a single extra copy each time (append-only, bounded by 200)
 app.click({dataset:{action:'journal-save-day-meal'}});
 assert.equal(JSON.parse(app.storage['forme-saved-meals']).length,2);
});
test('Exercise cards show the most recent set date next to the personal record',()=>{
 const app=boot('#exercises',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[
   {id:'a',exerciseId:'Pullups',kind:'reps',value:8,date:'2026-10-30'},
   {id:'b',exerciseId:'Pullups',kind:'reps',value:9,date:'2026-11-06'}
  ]})
 },new Date(2026,10,9,12));
 const results=app.node('exercise-results').innerHTML;
 assert.match(results,/★ 9 повторения[\s\S]*?class="chip">Последно 11-06<\/span>/);
 assert.equal((results.match(/Последно 11-06/g)||[]).length,1);
 assert.doesNotMatch(results,/Последно 10-30/);
});
test('Exercises offer a 1-tap "not trained in 14+ days" quick filter that isolates stale movements',()=>{
 const app=boot('#exercises',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[
   {id:'a',exerciseId:'Pullups',kind:'reps',value:9,date:'2026-11-08'},
   {id:'b',exerciseId:'Plank',kind:'seconds',value:40,date:'2026-10-01'}
  ]})
 },new Date(2026,10,9,12));
 const results=()=>app.node('exercise-results').innerHTML;
 assert.match(results(),/data-action="toggle-ex-stale" aria-pressed="false">Не са тренирани от 14 дни \(48\)/);

 app.click({dataset:{action:'toggle-ex-stale'}});
 assert.match(results(),/data-action="toggle-ex-stale" aria-pressed="true"/);
 assert.doesNotMatch(results(),/data-id="Pullups"/);
 assert.match(results(),/data-id="Plank"/);
 assert.match(results(),/Намерени 48 от 49 упражнения/);

 app.click({dataset:{action:'toggle-ex-stale'}});
 assert.match(results(),/Намерени 49 от 49 упражнения/);
});
test('Workout details report the most recent logged session (date and minutes) instead of the oldest one',()=>{
 const app=boot('#sessions',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sets:[],sessions:[
   {id:'a',workoutId:'cal-start',date:'2026-10-02',minutes:11},
   {id:'b',workoutId:'cal-start',date:'2026-11-06',minutes:18},
   {id:'c',workoutId:'cal-start',date:'2026-10-20',minutes:13}
  ]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/✓ 3 тренировки · 2026-11-06 · 42 мин/);
 assert.doesNotMatch(modal,/· 2026-10-02/);
});
test('Every live search offers a 1-tap clear button that resets the query and keeps focus in the field',()=>{
 // Progress journal search
 const progress=boot('#progress',{
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sets:[],sessions:[
   {id:'a',workoutId:'cal-start',date:'2026-11-05',minutes:20},
   {id:'b',workoutId:'mob-daily',date:'2026-11-06',minutes:10}
  ]})
 },new Date(2026,10,9,12));
 assert.match(progress.page(),/data-action="clear-search" data-target="progress"[^>]*hidden/);
 progress.input({dataset:{action:'progress-search'},value:'силна'});
 assert.match(progress.node('progress-history-results').innerHTML,/Силна основа/);
 let focused=false;
 progress.node('progress-search').focus=()=>{focused=true;};
 progress.click({dataset:{action:'clear-search',target:'progress'}});
 assert.equal(focused,true);
 assert.match(progress.page(),/Движи се свободно/);
 assert.match(progress.page(),/id="progress-search" type="search" data-action="progress-search" value=""/);

 // Favorites search
 const favs=boot('#favorites',{'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank']})},new Date(2026,10,9,12));
 assert.match(favs.page(),/data-action="clear-search" data-target="favorites"[^>]*hidden/);
 favs.input({dataset:{action:'favorites-search'},value:'планк'});
 favs.click({dataset:{action:'clear-search',target:'favorites'}});
 assert.match(favs.page(),/Планк/);

 // Saved meals search
 const saved=boot('#nutrition',{'forme-saved-meals':JSON.stringify([{name:'Обяд',items:[{id:'rice',grams:'150'}]},{name:'Закуска',items:[{id:'oats',grams:'60'}]}])},new Date(2026,10,9,12));
 saved.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(saved.page(),/data-action="clear-search" data-target="saved"[^>]*hidden/);
 saved.input({dataset:{action:'saved-meal-search'},value:'обяд'});
 saved.click({dataset:{action:'clear-search',target:'saved'}});
 assert.match(saved.page(),/Закуска/);
});

test('Month calendar shows the plan completion percentage for the visible month',()=>{
 const app=boot('#plan',{
  'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset',fri:'mob-daily'}),
  'forme-completed-workouts':JSON.stringify({'2026-11-09':{id:'cal-start',name:'Силна основа'}})
 },new Date(2026,10,11,12));
 app.click({dataset:{action:'plan-view',view:'month'}});
 app.click({dataset:{action:'plan-month',offset:'0'}});
 const page=app.page();
 // November 2026 has 5 Mondays, 4 Wednesdays, 4 Fridays => 13 planned days, 1 completed
 assert.match(page,/month-completion">Изпълнение на плана: <strong>8%<\/strong> \(1\/13\)/);
 assert.match(page,/month-completion[\s\S]*goal-meter[\s\S]*width:8%/);
});

test('Weekly plan view shows the same plan completion percentage as the month view',()=>{
 // 2026-11-11 is Wednesday; Monday 2026-11-09 was completed
 const app=boot('#plan',{
  'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset',fri:'mob-daily'}),
  'forme-completed-workouts':JSON.stringify({'2026-11-09':{id:'cal-start',name:'Силна основа'}})
 },new Date(2026,10,11,12));
 const page=app.page();
 assert.match(page,/plan-week-completion">Изпълнение на плана: <strong>33%<\/strong> \(1\/3\)/);
 assert.match(page,/plan-week-completion[\s\S]*goal-meter[\s\S]*width:33%/);

 const empty=boot('#plan',{},new Date(2026,10,11,12));
 assert.doesNotMatch(empty.page(),/plan-week-completion/);
});

test('Month selection can mark a single date as a rest day in one tap',()=>{
 const app=boot('#plan',{'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset'})},new Date(2026,10,11,12));
 app.click({dataset:{action:'plan-view',view:'month'}});
 app.click({dataset:{action:'plan-date',date:'18'}});
 const page=app.page();
 assert.match(page,/data-action="copy-date-rest" data-id="yoga-reset" data-date="2026-11-18" aria-label="Маркирай като почивен ден: 2026-11-18">Празен ден/);

 app.click({dataset:{action:'copy-date-rest',id:'yoga-reset',date:'2026-11-18'}});
 assert.equal(JSON.parse(app.storage['forme-date-plans'])['2026-11-18'],'');
 assert.match(app.toast(),/Почивният ден е запазен/);
 assert.match(app.page(),/data-action="reset-date-plan"/);
 assert.doesNotMatch(app.page(),/data-action="copy-date-rest"/);
 assert.match(app.page(),/Избор само за тази дата/);
});

test('Weekly plan view offers 1-tap rest buttons for every date-only override (week-mark-rest)',()=>{
 const app=boot('#plan',{
  'forme-language':'bg',
  'forme-plan':JSON.stringify({mon:'cal-start',tue:'yoga-reset'}),
  'forme-date-plans':JSON.stringify({'2026-11-10':'yoga-reset','2026-11-12':''})
 },new Date(2026,10,9,12));
 const page=app.page();
 assert.match(page,/class="plan-rest-quick"/);
 assert.match(page,/data-action="week-mark-rest" data-date="2026-11-10" aria-label="Маркирай като почивен ден: 2026-11-10 \(Спокойно възстановяване\)">Празен ден · ВТО/);
 assert.doesNotMatch(page,/data-action="week-mark-rest" data-date="2026-11-12"/);
 assert.equal((page.match(/data-action="week-mark-rest"/g)||[]).length,1);

 app.click({dataset:{action:'week-mark-rest',date:'2026-11-10'}});
 assert.deepEqual(JSON.parse(app.storage['forme-date-plans']),{'2026-11-10':'','2026-11-12':''});
 assert.match(app.toast(),/Почивният ден е запазен/);
 assert.doesNotMatch(app.page(),/data-action="week-mark-rest"/);
 assert.match(app.page(),/day-date-override">Избор само за тази дата: <strong>Почивка<\/strong>/);
});

test('Weekly plan view hides the rest quick-picker when no date override exists',()=>{
 const app=boot('#plan',{'forme-language':'bg','forme-plan':JSON.stringify({mon:'cal-start'})},new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/plan-rest-quick|week-mark-rest/);
});

test('Catalog searches (workouts / exercises / foods) get the same 1-tap × clear button',()=>{
 const workouts=boot('#sessions',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(workouts.page(),/data-action="clear-search" data-target="workouts" aria-label="Изчисти търсенето"[^>]*hidden>×/);
 workouts.change({dataset:{filter:'workouts',key:'q'},value:'йога',nextElementSibling:{dataset:{action:'clear-search'},removeAttribute(){},setAttribute(){}}});
 assert.match(workouts.node('workout-results').innerHTML,/Намерени \d+ от \d+ тренировки/);
 workouts.click({dataset:{action:'clear-search',target:'workouts'}});
 assert.equal(workouts.node('workout-search').value,'');
 assert.match(workouts.node('workout-results').innerHTML,/Намерени 6 от 6 тренировки/);

 const exercises=boot('#exercises',{'forme-language':'bg'},new Date(2026,10,9,12));
 exercises.change({dataset:{filter:'exercises',key:'q'},value:'планк',nextElementSibling:{dataset:{action:'clear-search'},removeAttribute(){},setAttribute(){}}});
 exercises.click({dataset:{action:'clear-search',target:'exercises'}});
 assert.equal(exercises.node('ex-search').value,'');
 assert.match(exercises.node('exercise-results').innerHTML,/Намерени 49 от 49 упражнения/);

 const foods=boot('#nutrition',{'forme-language':'bg'},new Date(2026,10,9,12));
 foods.change({dataset:{filter:'foods',key:'q'},value:'ориз',nextElementSibling:{dataset:{action:'clear-search'},removeAttribute(){},setAttribute(){}}});
 foods.click({dataset:{action:'clear-search',target:'foods'}});
 assert.equal(foods.node('food-search').value,'');
 assert.match(foods.node('food-results').innerHTML,/Намерени 30 от 30 храни/);
});

test('Weekly plan day cards clear a single planned day in one tap (clear-plan-day)',()=>{
 const app=boot('#plan',{
  'forme-language':'bg',
  'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset'})
 },new Date(2026,10,9,12));
 assert.match(app.page(),/class="btn btn-small plan-day-clear" data-action="clear-plan-day" data-day="mon" aria-label="Изчисти деня от плана: ПОН" title="Изчисти деня от плана">×/);
 assert.equal((app.page().match(/data-action="clear-plan-day"/g)||[]).length,2);

 app.click({dataset:{action:'clear-plan-day',day:'mon'}});
 assert.deepEqual(JSON.parse(app.storage['forme-plan']),{wed:'yoga-reset'});
 assert.match(app.toast(),/Денят е изчистен от седмичния план/);
 assert.equal((app.page().match(/data-action="clear-plan-day"/g)||[]).length,1);
 assert.match(app.page(),/1 от 7 дни/);
 assert.doesNotMatch(app.page(),/data-action="clear-plan-day" data-day="mon"/);
});

test('Weekly plan hides the day-clear × for empty days',()=>{
 const app=boot('#plan',{'forme-language':'bg','forme-plan':JSON.stringify({})},new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/data-action="clear-plan-day"/);
});

test('Workout details link the done-history line to the progress log filtered by this workout (workout-history-progress)',()=>{
 const app=boot('#sessions',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-06',minutes:42},{id:'s2',workoutId:'yoga-reset',date:'2026-11-03',minutes:20}],sets:[]})
 },new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/data-action="workout-detail" data-id="cal-start"/);
 app.click({dataset:{action:'workout-detail',id:'cal-start'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/completion-status[^>]*>✓ 1 тренировки · 2026-11-06 · 42 мин · <button[^>]*data-action="workout-history-progress" data-id="cal-start"/);
 app.click({dataset:{action:'workout-history-progress',id:'cal-start'}});
 const progress=app.page();
 assert.match(progress,/id="progress-search"[^>]*value="Силна основа"/);
 assert.match(progress,/data-action="progress-filter" data-view="workout" aria-pressed="true"/);
 const history=app.page().slice(app.page().indexOf('progress-history-results'));
 assert.match(history,/2026-11-06/);
 assert.doesNotMatch(history,/2026-11-03/);
});

test('Exercise details link to the progress log filtered by that exercise (exercise-history-progress)',()=>{
 const app=boot('#exercises',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[
   {id:'x1',exerciseId:'Plank',date:'2026-11-06',kind:'seconds',value:55},
   {id:'x2',exerciseId:'Pushups',date:'2026-11-04',kind:'reps',value:12}
  ]})
 },new Date(2026,10,9,12));
 app.change({dataset:{filter:'exercises',key:'q'},value:'планк',nextElementSibling:{dataset:{action:'clear-search'},removeAttribute(){},setAttribute(){}}});
 assert.match(app.node('exercise-results').innerHTML,/data-action="exercise-detail" data-id="Plank"/);
 app.click({dataset:{action:'exercise-detail',id:'Plank'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/data-action="exercise-history-progress" data-id="Plank" aria-label="Виж в дневника на прогреса: Планк"/);
 app.click({dataset:{action:'exercise-history-progress',id:'Plank'}});
 const progress=app.page();
 assert.match(progress,/id="progress-search"[^>]*value="Планк"/);
 assert.match(progress,/data-action="progress-filter" data-view="set" aria-pressed="true"/);
 const history=progress.slice(progress.indexOf('progress-history-results'));
 assert.match(history,/2026-11-06/);
 assert.doesNotMatch(history,/2026-11-04/);
});

test('Workout cards log the session for today in one tap (quick-log-workout)',()=>{
 const app=boot('#sessions',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/data-action="quick-log-workout" data-id="cal-start" aria-label="Запиши тренировка в дневника: Силна основа">\+ Дневник/);
 app.click({dataset:{action:'quick-log-workout',id:'cal-start'}});
 const saved=JSON.parse(app.storage['forme-progress-v1']);
 assert.equal(saved.sessions.length,1);
 assert.equal(saved.sessions[0].workoutId,'cal-start');
 assert.equal(saved.sessions[0].date,'2026-11-09');
 assert.equal(saved.sessions[0].minutes,12);
 assert.match(app.toast(),/Тренировката е записана/);
 const card=app.node('workout-results').innerHTML;
 assert.match(card,/✓ 1×/);
 assert.match(card,/Последно 11-09/);

 app.click({dataset:{action:'quick-log-workout',id:'cal-start'}});
 assert.equal(JSON.parse(app.storage['forme-progress-v1']).sessions.length,1);
 assert.match(app.toast(),/вече е записана за днес/);
});

test('Home today card marks today as a rest day in one tap (plan-rest-today)',()=>{
 const app=boot('#home',{'forme-language':'bg','forme-plan':JSON.stringify({mon:'cal-start'})},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="plan-rest-today" aria-label="Маркирай като почивен ден: Днес">Почивка днес/);
 app.click({dataset:{action:'plan-rest-today'}});
 assert.deepEqual(JSON.parse(app.storage['forme-date-plans']),{'2026-11-09':''});
 assert.match(app.toast(),/Почивният ден е запазен/);
 assert.doesNotMatch(app.page(),/data-action="plan-rest-today"/);
 assert.match(app.page(),/today-next-up/);
});

test('Home today card hides the rest button when today is already a rest day',()=>{
 const app=boot('#home',{'forme-language':'bg','forme-plan':JSON.stringify({tue:'cal-start'})},new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/data-action="plan-rest-today"/);
});

test('Journal day header copies the whole day to tomorrow in one tap (journal-copy-next-day)',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[
   {id:'a',date:'2026-11-09',name:'Сутрин',items:[{id:'egg',grams:'100'},{id:'oats',grams:'80'}]}
  ]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-copy-next-day" aria-label="Копирай за утре">Копирай за утре →/);
 app.click({dataset:{action:'journal-copy-next-day'}});
 const saved=JSON.parse(app.storage['forme-nutrition-v1']);
 const next=saved.entries.filter(e=>e.date==='2026-11-10');
 assert.equal(next.length,1);
 assert.deepEqual(next[0].items.map(i=>i.id).sort(),['egg','oats']);
 assert.match(app.toast(),/копирани за утре/);
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-10"/);
});

test('Journal copy-to-tomorrow is not offered for an empty day',()=>{
 const app=boot('#nutrition',{'forme-language':'bg'},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.doesNotMatch(app.page(),/data-action="journal-copy-next-day"/);
});

test('Saved meals can be logged to yesterday in one tap (log-saved-meal-prev)',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-saved-meals':JSON.stringify([{name:'След тренировка',items:[{id:'chicken',grams:'200'}]}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'saved'}});
 assert.match(app.page(),/data-action="log-saved-meal-prev" data-index="0" aria-label="Запиши за вчера: След тренировка" title="Запиши за вчера">↩ вчера/);
 app.click({dataset:{action:'log-saved-meal-prev',index:'0'}});
 const saved=JSON.parse(app.storage['forme-nutrition-v1']);
 assert.equal(saved.entries.length,1);
 assert.equal(saved.entries[0].date,'2026-11-08');
 assert.match(app.toast(),/записано за вчера/);
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/id="journal-date" type="date" value="2026-11-08"/);
});

test('Favorites page clears an active section filter and search in one tap (reset-favorites-filters)',()=>{
 const app=boot('#favorites',{
  'forme-language':'bg',
  'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank'],foods:['rice']})
 },new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/data-action="reset-favorites-filters"/);
 app.click({dataset:{action:'favorites-filter',view:'exercises'}});
 assert.match(app.page(),/data-action="reset-favorites-filters">Изчисти филтрите/);
 assert.match(app.page(),/data-action="favorites-filter" data-view="exercises" aria-pressed="true"\>Упражнения \(1\)/);
 app.click({dataset:{action:'reset-favorites-filters'}});
 assert.match(app.toast(),/Филтрите са изчистени/);
 assert.match(app.page(),/data-action="favorites-filter" data-view="all" aria-pressed="true"\>Всички \(3\)/);
 assert.doesNotMatch(app.page(),/data-action="reset-favorites-filters"/);
});

test('Favorites search also triggers the one-tap filter reset',()=>{
 const app=boot('#favorites',{
  'forme-language':'bg',
  'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank'],foods:['rice']})
 },new Date(2026,10,9,12));
 assert.equal(app.node('favorites-reset-slot').innerHTML,'');
 app.input({dataset:{action:'favorites-search'},value:'планк',nextElementSibling:{dataset:{action:'clear-search'},removeAttribute(){},setAttribute(){}}});
 assert.match(app.node('favorites-reset-slot').innerHTML,/data-action="reset-favorites-filters"/);
 app.click({dataset:{action:'reset-favorites-filters'}});
 assert.match(app.page(),/data-action="favorites-search" value=""/);
});

test('Progress weekly goal can be raised by one workout in a tap (goal-plus-workout)',()=>{
 const app=boot('#progress',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="goal-plus-workout" aria-label="Увеличи седмичната цел с 1 тренировка"[^>]*>\+1</);
 app.click({dataset:{action:'goal-plus-workout'}});
 assert.equal(journalGoal(app).workoutsPerWeek,4);
 assert.equal(journalGoal(app).minutesPerWeek,90);
 assert.match(app.toast(),/увеличена\. \(4×\)/);
 assert.match(app.page(),/<strong>0 \/ 4<\/strong>/);
});

test('goal-plus-workout stops at the maximum of 7 workouts per week',()=>{
 const app=boot('#progress',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:7,minutesPerWeek:150},sessions:[],sets:[]})
 },new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/data-action="goal-plus-workout"/);
});

function journalGoal(app){return JSON.parse(app.storage['forme-progress-v1']).goal;}

test('Progress weekly goal can be lowered by one workout in a tap (goal-minus-workout)',()=>{
 const app=boot('#progress',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="goal-minus-workout" aria-label="Намали седмичната цел с 1 тренировка"[^>]*>−1</);
 app.click({dataset:{action:'goal-minus-workout'}});
 assert.equal(JSON.parse(app.storage['forme-progress-v1']).goal.workoutsPerWeek,2);
 assert.equal(JSON.parse(app.storage['forme-progress-v1']).goal.minutesPerWeek,90);
 assert.match(app.toast(),/намалена\. \(2×\)/);
});

test('goal-minus-workout stops at the minimum of 1 workout per week',()=>{
 const app=boot('#progress',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:1,minutesPerWeek:30},sessions:[],sets:[]})
 },new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/data-action="goal-minus-workout"/);
 assert.match(app.page(),/data-action="goal-plus-workout"/);
});

test('Progress weekly minute goal steps by 15 in one tap (goal-plus-minutes / goal-minus-minutes)',()=>{
 const app=boot('#progress',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.page(),/data-action="goal-plus-minutes" aria-label="Увеличи седмичната цел с 15 минути"[^>]*>\+15</);
 app.click({dataset:{action:'goal-plus-minutes'}});
 assert.equal(JSON.parse(app.storage['forme-progress-v1']).goal.minutesPerWeek,105);
 assert.equal(JSON.parse(app.storage['forme-progress-v1']).goal.workoutsPerWeek,3);
 assert.match(app.toast(),/увеличена\. \(105 мин\)/);
 app.click({dataset:{action:'goal-minus-minutes'}});
 assert.equal(JSON.parse(app.storage['forme-progress-v1']).goal.minutesPerWeek,90);
 assert.match(app.toast(),/намалена\. \(90 мин\)/);
});

test('goal-minus-minutes stops at zero minutes',()=>{
 const app=boot('#progress',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:0},sessions:[],sets:[]})
 },new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/data-action="goal-minus-minutes"/);
 assert.match(app.page(),/data-action="goal-plus-minutes"/);
});

test('Journal entries can be duplicated in one tap (journal-duplicate button)',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[
   {id:'a',date:'2026-11-09',name:'Закуска',items:[{id:'oats',grams:'80'},{id:'egg',grams:'100'}]}
  ]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'journal'}});
 assert.match(app.page(),/data-action="journal-duplicate" data-id="a" aria-label="Копирай записа: Закуска" title="Копирай записа">⧉/);
 app.click({dataset:{action:'journal-duplicate',id:'a'}});
 const saved=JSON.parse(app.storage['forme-nutrition-v1']);
 assert.equal(saved.entries.length,2);
 assert.equal(saved.entries[1].date,'2026-11-09');
 assert.equal(saved.entries[1].name,'Закуска');
 assert.deepEqual(saved.entries[1].items.map(i=>i.id),['oats','egg']);
 assert.match(app.toast(),/Записът е запазен/);
});

test('Exercise details repeat a past set in one tap (repeat-set chip buttons)',()=>{
 const app=boot('#exercises',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[
   {id:'x1',exerciseId:'Plank',date:'2026-11-02',kind:'seconds',value:45},
   {id:'x2',exerciseId:'Plank',date:'2026-11-05',kind:'seconds',value:55}
  ]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'exercise-detail',id:'Plank'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/data-action="repeat-set" data-id="Plank" data-kind="seconds" data-value="55" aria-label="Повтори серията: 55 секунди, 2026-11-05" title="Повтори серията">↻ 2026-11-05: 55 секунди/);
 app.click({dataset:{action:'repeat-set',id:'Plank',kind:'seconds',value:'55'}});
 const sets=JSON.parse(app.storage['forme-progress-v1']).sets;
 assert.equal(sets.length,3);
 assert.equal(sets[2].exerciseId,'Plank');
 assert.equal(sets[2].value,55);
 assert.equal(sets[2].kind,'seconds');
 assert.equal(sets[2].date,'2026-11-09');
 assert.match(app.toast(),/Серията е записана\. \(55\)/);
});

test('Exercise details keep the chip history plain when fewer than two sets exist',()=>{
 const app=boot('#exercises',{
  'forme-language':'bg',
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[
   {id:'x1',exerciseId:'Plank',date:'2026-11-05',kind:'seconds',value:55}
  ]})
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'exercise-detail',id:'Plank'}});
 assert.doesNotMatch(app.node('modal-root').innerHTML,/data-action="repeat-set"/);
});

test('Home offers a 1-tap "same as yesterday" plan copy when today has no workout (plan-copy-yesterday)',()=>{
 const app=boot('#home',{
  'forme-language':'bg',
  'forme-plan':JSON.stringify({sun:'yoga-reset'})
 },new Date(2026,10,9,12));
 const page=app.page();
 assert.match(page,/data-action="plan-copy-yesterday" data-id="yoga-reset" aria-label="Като вчера: Спокойно възстановяване">↩ Като вчера: Спокойно възстановяване/);
 app.click({dataset:{action:'plan-copy-yesterday',id:'yoga-reset'}});
 assert.deepEqual(JSON.parse(app.storage['forme-date-plans']),{'2026-11-09':'yoga-reset'});
 assert.match(app.toast(),/Вчерашната тренировка е планирана за днес/);
 assert.match(app.page(),/today-plan-name">Спокойно възстановяване/);
});

test('Home does not offer "same as yesterday" when today already has a workout',()=>{
 const app=boot('#home',{
  'forme-language':'bg',
  'forme-plan':JSON.stringify({sun:'yoga-reset',mon:'cal-start'})
 },new Date(2026,10,9,12));
 assert.doesNotMatch(app.page(),/data-action="plan-copy-yesterday"/);
});

test('Meal rows offer ±100 g steppers next to ±25 g in one tap (step-meal-grams)',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'200'}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 const rows=app.page();
 assert.match(rows,/data-action="step-meal-grams" data-index="0" data-delta="-100" aria-label="Грамаж за Пилешки гърди -100">-100/);
 assert.match(rows,/data-action="step-meal-grams" data-index="0" data-delta="100" aria-label="Грамаж за Пилешки гърди \+100">\+100/);
 assert.match(rows,/data-action="step-meal-grams" data-index="0" data-delta="-25"/);
 assert.match(rows,/data-action="step-meal-grams" data-index="0" data-delta="25"/);

 app.click({dataset:{action:'step-meal-grams',index:'0',delta:'100'}});
 assert.equal(JSON.parse(app.storage['forme-current-meal'])[0].grams,'300');
 app.click({dataset:{action:'step-meal-grams',index:'0',delta:'-100'}});
 assert.equal(JSON.parse(app.storage['forme-current-meal'])[0].grams,'200');
 app.click({dataset:{action:'step-meal-grams',index:'0',delta:'-100'}});
 assert.equal(JSON.parse(app.storage['forme-current-meal'])[0].grams,'100');
});

test('Food details and meal builder offer 300 g and 500 g one-tap portion presets',()=>{
 const app=boot('#nutrition',{'forme-language':'bg'},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-detail',id:'chicken'}});
 const modal=app.node('modal-root').innerHTML;
 assert.match(modal,/data-action="detail-preset-grams" data-id="chicken" data-grams="300" aria-pressed="false">300 г/);
 assert.match(modal,/data-action="detail-preset-grams" data-id="chicken" data-grams="500" aria-pressed="false">500 г/);
 app.click({dataset:{action:'detail-preset-grams',id:'chicken',grams:'500'}});
 assert.equal(app.node('detail-grams').value,'500');
 assert.match(app.node('detail-table').innerHTML,/600 kcal/);
});

test('Meal builder portion presets include 300 g and 500 g',()=>{
 const app=boot('#nutrition',{'forme-language':'bg'},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 const page=app.page();
 assert.match(page,/data-action="meal-preset-grams" data-grams="300"/);
 assert.match(page,/data-action="meal-preset-grams" data-grams="500"/);
});

test('Meal totals offer a 1-tap "save the plate" button that writes the journal and clears the plate (save-plate)',()=>{
 const app=boot('#nutrition',{
  'forme-language':'bg',
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'200'},{id:'rice',grams:'150'}])
 },new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.match(app.page(),/data-action="save-plate" aria-label="Запиши чинията в дневника"[^>]*>▸ Запиши чинията в дневника/);
 app.click({dataset:{action:'save-plate'}});
 const saved=JSON.parse(app.storage['forme-nutrition-v1']);
 assert.equal(saved.entries.length,1);
 assert.equal(saved.entries[0].date,'2026-11-09');
 assert.deepEqual(saved.entries[0].items.map(i=>i.id),['chicken','rice']);
 assert.deepEqual(JSON.parse(app.storage['forme-current-meal']),[]);
 assert.match(app.toast(),/Записът е запазен/);
});

test('save-plate is hidden on an empty plate',()=>{
 const app=boot('#nutrition',{'forme-language':'bg'},new Date(2026,10,9,12));
 app.click({dataset:{action:'food-tab',tab:'meal'}});
 assert.doesNotMatch(app.page(),/data-action="save-plate"/);
	assert.match(app.page(),/Празна чиния/);
});

test('Workout cards plan the workout for tomorrow in one tap (workout-plan-tomorrow)',()=>{
 const app=boot('#sessions',{'forme-language':'bg'},new Date(2026,10,9,12));
 assert.match(app.node('workout-results').innerHTML,/data-action="workout-plan-tomorrow" data-id="cal-start" aria-label="Утре · Моят план: Силна основа">\+ Утре/);
 app.click({dataset:{action:'workout-plan-tomorrow',id:'cal-start'}});
 assert.deepEqual(JSON.parse(app.storage['forme-date-plans']),{'2026-11-10':'cal-start'});
 assert.match(app.toast(),/Планът за тази дата е запазен/);
 assert.doesNotMatch(app.node('workout-results').innerHTML,/data-action="workout-plan-tomorrow" data-id="cal-start"/);
});
