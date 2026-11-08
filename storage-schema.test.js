const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('storage-schema.js','utf8'),context);
const create=context.window.FORME_STORAGE_SCHEMA.create;
function storage(initial={}){const data={...initial};let fail=null;return {data,getItem:key=>data[key]??null,setItem(key,value){if(key===fail)throw Error('quota');data[key]=value;},removeItem:key=>{delete data[key];},failOn:key=>{fail=key;}};}
test('legacy favorites, plans and saved meals migrate into versioned storage',()=>{
 const initial={'forme-favorites':'{"exercises":["Pushups"],"workouts":[]}','forme-plan':'{"mon":"cal-start"}','forme-saved-meals':'[{"name":"Lunch","items":[]}]'};
 const store=storage(initial),api=create(store),migrated=JSON.parse(store.data['forme-user-v1']);
 assert.equal(migrated.version,1);assert.equal(api.load('favorites',{}).exercises[0],'Pushups');
 assert.equal(api.load('plan',{}).mon,'cal-start');assert.equal(api.load('saved-meals',[])[0].name,'Lunch');
 assert.equal(create(store).load('plan',{}).mon,'cal-start');
});
test('updated legacy keys and versioned data stay in sync and failed write rolls back',()=>{
 const store=storage({'forme-plan':'{"mon":"cal-start"}'}),api=create(store);
 assert.equal(api.save('plan',{tue:'yoga-reset'}),true);
 assert.equal(JSON.parse(store.data['forme-plan']).tue,'yoga-reset');
 const before=store.data['forme-user-v1'];store.failOn('forme-plan');
 assert.equal(api.save('plan',{wed:'mob-daily'}),false);
 assert.equal(store.data['forme-user-v1'],before);
 assert.equal(api.load('plan',{}).tue,'yoga-reset');
});
