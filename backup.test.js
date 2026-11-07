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
