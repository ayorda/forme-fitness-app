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































