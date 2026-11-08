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
