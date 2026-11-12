const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},Date,JSON};vm.createContext(context);vm.runInContext(fs.readFileSync('backup.js','utf8'),context);
const backup=context.window.FORME_BACKUP;
function storage(initial={},failKey){const data={...initial};return {data,getItem:key=>data[key]??null,setItem(key,value){if(key===failKey)throw Error('quota');data[key]=value;},removeItem:key=>{delete data[key];}};}
test('JSON backup restores legacy keys and new journals',()=>{
 const source=storage({'forme-favorites':'{"exercises":[],"workouts":[]}','forme-language':'de','forme-progress-v1':'{"version":1,"sessions":[],"sets":[],"goal":{"workoutsPerWeek":3,"minutesPerWeek":90}}','forme-nutrition-v1':'{"version":1,"entries":[],"goal":{"kcal":2000,"protein":100}}'});
 const text=backup.exportData(source),target=storage({'forme-plan':'{"mon":"cal-start"}'});
 assert.equal(backup.importData(target,text),true);
 assert.equal(target.data['forme-language'],'de');assert.equal(target.data['forme-plan'],undefined);
 assert.equal(target.data['forme-nutrition-v1'],source.data['forme-nutrition-v1']);
});
test('invalid archive and failed writes preserve previous data',()=>{
 const original={'forme-favorites':'{"exercises":[],"workouts":[]}','forme-language':'bg'},target=storage(original,'forme-language');
 assert.equal(backup.importData(target,'{"app":"FORME","version":1,"data":{"unknown":"x"}}'),false);
 const source=storage({'forme-favorites':'{"exercises":["Pushups"],"workouts":[]}','forme-language':'en'});
 assert.equal(backup.importData(target,backup.exportData(source)),false);
 assert.deepEqual(target.data,original);
});

test('restore rejects invalid journal values and nested legacy records without changing data',()=>{
 const original={'forme-plan':'{"mon":"cal-start"}'},date='2026-11-08';
 const invalid=[
  {'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'x',workoutId:'cal-start',date,minutes:-50}],sets:[]})},
  {'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:9,minutesPerWeek:90},sessions:[],sets:[]})},
  {'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:-1,protein:100},entries:[]})},
  {'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'x',date,name:'Meal',items:[{id:'rice',grams:'0'}]}]})},
  {'forme-user-v1':JSON.stringify({version:1,records:{'current-meal':'[{"id":"rice","grams":"-50"}]'}})}
 ];
 for(const data of invalid){const target=storage(original);const text=JSON.stringify({app:'FORME',version:1,data});assert.equal(backup.importData(target,text),false,Object.keys(data)[0]);assert.deepEqual(target.data,original);}
});

test('restore accepts valid versioned records from a current backup',()=>{
 const data={'forme-user-v1':JSON.stringify({version:1,records:{favorites:'{"exercises":["Pushups"],"workouts":[]}',sound:'true'}})};
 const target=storage();assert.equal(backup.importData(target,JSON.stringify({app:'FORME',version:1,data})),true);
 assert.equal(target.data['forme-user-v1'],data['forme-user-v1']);
});

test('backup round trip accepts comma decimal grams used by the meal builder',()=>{
 const source=storage({
  'forme-current-meal':'[{"id":"rice","grams":"125,5"}]',
  'forme-saved-meals':'[{"name":"Lunch","items":[{"id":"rice","grams":"125,5"}]}]',
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'meal-1',date:'2026-11-08',name:'Lunch',items:[{id:'rice',grams:'125,5'}]}]})
 });
 const target=storage();assert.equal(backup.importData(target,backup.exportData(source)),true);
 assert.equal(target.data['forme-current-meal'],source.data['forme-current-meal']);
 assert.equal(target.data['forme-nutrition-v1'],source.data['forme-nutrition-v1']);
});

test('exportData cleans unfinished draft meal rows and broken legacy keys so every exported backup restores',()=>{
 const source=storage({
  'forme-plan':'{"mon":"cal-start"}',
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'200'},{id:'rice',grams:''},{id:'egg',grams:'0'}]),
  'forme-saved-meals':JSON.stringify([{name:'Valid',items:[{id:'rice',grams:'150'}]},{name:'Broken',items:[{id:'rice',grams:'0'}]}]),
  'forme-user-v1':JSON.stringify({version:1,records:{'current-meal':JSON.stringify([{id:'chicken',grams:'200'},{id:'rice',grams:''}]),plan:'{"mon":"cal-start"}',sound:'"not-bool"'}}),
  'forme-sound':'"not-bool"',
  'forme-progress-v1':JSON.stringify({version:1,sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:12}],sets:[],goal:{workoutsPerWeek:3,minutesPerWeek:90}})
 });
 const exported=backup.exportData(source),target=storage();
 assert.equal(backup.importData(target,exported),true);
 assert.deepEqual(JSON.parse(target.data['forme-current-meal']),[{id:'chicken',grams:'200'}]);
 assert.equal(JSON.parse(target.data['forme-saved-meals']).length,1);
 assert.equal(target.data['forme-sound'],undefined);
 assert.equal(JSON.parse(target.data['forme-progress-v1']).sessions.length,1);
});

test('exportData preserves valid progress sessions, nutrition entries, favorites and completions when mixed with broken items',()=>{
 const source=storage({
  'forme-favorites':JSON.stringify({exercises:['Plank',42],workouts:['cal-start',null]}),
  'forme-plan':JSON.stringify({mon:'cal-start',tue:123}),
  'forme-completed-workouts':JSON.stringify({'2026-11-09':{id:'cal-start',name:'Силна основа'},'bad-date':{id:'x',name:'y'}}),
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:99,minutesPerWeek:-10},
   sessions:[{id:'s1',workoutId:'cal-start',date:'2026-11-09',minutes:12},{id:'bad',workoutId:'cal-start',date:'2026-02-30',minutes:10}],
   sets:[{id:'set1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:45},{id:'badset',exerciseId:'Plank',date:'2026-11-09',kind:'meters',value:10}]
  }),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:0,protein:5000},
   entries:[
    {id:'e1',date:'2026-11-09',name:'Lunch',items:[{id:'rice',grams:'150'},{id:'egg',grams:'0'}]},
    {id:'e2',date:'2026-11-09',name:'Broken',items:[{id:'rice',grams:'0'}]}
   ]
  })
 });
 const exported=backup.exportData(source),target=storage();
 assert.equal(backup.importData(target,exported),true);
 assert.deepEqual(JSON.parse(target.data['forme-favorites']),{exercises:['Plank'],workouts:['cal-start']});
 assert.deepEqual(JSON.parse(target.data['forme-plan']),{mon:'cal-start'});
 assert.equal(Object.keys(JSON.parse(target.data['forme-completed-workouts'])).length,1);
 const prog=JSON.parse(target.data['forme-progress-v1']);
 assert.equal(prog.sessions.length,1);
 assert.equal(prog.sets.length,1);
 const nutr=JSON.parse(target.data['forme-nutrition-v1']);
 assert.equal(nutr.entries.length,1);
 assert.deepEqual(nutr.entries[0].items,[{id:'rice',grams:'150'}]);
});

test('backup rejects duplicate journal IDs and blank saved-meal names while exportData deduplicates and trims',()=>{
 const dupProgress=JSON.stringify({app:'FORME',version:1,data:{'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'dup',workoutId:'cal-start',date:'2026-11-09',minutes:12},{id:'dup',workoutId:'mob-daily',date:'2026-11-08',minutes:10}],sets:[]})}});
 const blankSaved=JSON.stringify({app:'FORME',version:1,data:{'forme-saved-meals':JSON.stringify([{name:'   ',items:[{id:'rice',grams:'100'}]}])}});
 const target=storage({'forme-language':'bg'});
 assert.equal(backup.importData(target,dupProgress),false);
 assert.equal(backup.importData(target,blankSaved),false);
 assert.equal(target.data['forme-language'],'bg');

 const messy=storage({
  'forme-saved-meals':JSON.stringify([{name:'  Обяд  ',items:[{id:'rice',grams:'150'}]},{name:'   ',items:[{id:'rice',grams:'100'}]}]),
  'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'dup',workoutId:'cal-start',date:'2026-11-09',minutes:12},{id:'dup',workoutId:'mob-daily',date:'2026-11-08',minutes:10}],sets:[{id:'s1',exerciseId:'Plank',date:'2026-11-09',kind:'seconds',value:45},{id:'s1',exerciseId:'Plank',date:'2026-11-08',kind:'seconds',value:30}]}),
  'forme-nutrition-v1':JSON.stringify({version:1,goal:{kcal:2000,protein:100},entries:[{id:'e1',date:'2026-11-09',name:'Обяд',items:[{id:'rice',grams:'150'}]},{id:'e1',date:'2026-11-08',name:'Вечеря',items:[{id:'egg',grams:'100'}]}]})
 });
 const exported=backup.exportData(messy),restored=storage();
 assert.equal(backup.importData(restored,exported),true);
 assert.deepEqual(JSON.parse(restored.data['forme-saved-meals']),[{name:'Обяд',items:[{id:'rice',grams:'150'}]}]);
 assert.equal(JSON.parse(restored.data['forme-progress-v1']).sessions.length,1);
 assert.equal(JSON.parse(restored.data['forme-progress-v1']).sets.length,1);
 assert.equal(JSON.parse(restored.data['forme-nutrition-v1']).entries.length,1);
});

test('backup validates and cleans completion marks and overlong IDs',()=>{
 const blankComp=JSON.stringify({app:'FORME',version:1,data:{'forme-completed-workouts':JSON.stringify({'2026-11-09':{id:'cal-start',name:'   '}})}});
 const longId=JSON.stringify({app:'FORME',version:1,data:{'forme-completed-workouts':JSON.stringify({'2026-11-09':{id:'a'.repeat(61),name:'Test'}})}});
 const target=storage({'forme-language':'bg'});
 assert.equal(backup.importData(target,blankComp),false);
 assert.equal(backup.importData(target,longId),false);
 assert.equal(target.data['forme-language'],'bg');

 const dirty=storage({
  'forme-completed-workouts':JSON.stringify({'2026-11-09':{id:'cal-start',name:'  Силна основа  '},'2026-11-10':{id:'cal-start',name:'   '},'2026-11-11':{id:'x'.repeat(61),name:'Bad'}})
 });
 const exported=backup.exportData(dirty),restored=storage();
 assert.equal(backup.importData(restored,exported),true);
 assert.deepEqual(JSON.parse(restored.data['forme-completed-workouts']),{'2026-11-09':{id:'cal-start',name:'Силна основа'}});
});

test('backup export and import enforce 500-item favorites and 2000-item date-plans caps',()=>{
 const hugeFavs=Array.from({length:520},(_,i)=>'ex-'+i);
 const hugeDates=Object.fromEntries(Array.from({length:2005},(_,i)=>['2026-01-'+String(i), 'cal-start']));
 const target=storage({'forme-language':'bg'});
 assert.equal(backup.importData(target,JSON.stringify({app:'FORME',version:1,data:{'forme-favorites':JSON.stringify({exercises:hugeFavs,workouts:[]})}})),false);
 assert.equal(backup.importData(target,JSON.stringify({app:'FORME',version:1,data:{'forme-date-plans':JSON.stringify(hugeDates)}})),false);
 const exported=backup.exportData(storage({
  'forme-favorites':JSON.stringify({exercises:hugeFavs,workouts:[]}),
  'forme-date-plans':JSON.stringify(hugeDates)
 })),restored=storage();
 assert.equal(backup.importData(restored,exported),true);
 assert.equal(JSON.parse(restored.data['forme-favorites']).exercises.length,500);
 assert.equal(Object.keys(JSON.parse(restored.data['forme-date-plans'])).length,2000);
});



