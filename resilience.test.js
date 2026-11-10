const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(hash,storage={}){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,activeElement:{isConnected:true,focus(){}},getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}};
 const context={window,document,localStorage,location:{hash},Date,setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);
 for(const file of ['exercise-art.js','data.js','core.js','food-art.js','state-normalizer.js','storage-schema.js','progress.js','programs.js','nutrition-journal.js','backup.js','app.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 const page=()=>nodes.app.innerHTML;
 return {
  page,
  node:id=>document.getElementById(id),
  toast:()=>nodes.toast.textContent,
  storage,
  click:target=>handlers.click({target:{closest:()=>target}}),
  change:target=>handlers.change({target}),
  input:target=>handlers.input({target}),
  keydown:event=>handlers.keydown(event)
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
