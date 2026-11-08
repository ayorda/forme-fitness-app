const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(initial={}){
 const data={...initial},storage={getItem:key=>data[key]??null,setItem:(key,value)=>{data[key]=value;}};
 const context={window:{FORME_EXERCISE_ART:{url:()=> 'placeholder'}},Date,Math};vm.createContext(context);
 for(const file of ['data.js','core.js','nutrition-journal.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 const {foods}=context.window.FORME_DATA,core=context.window.FORME_CORE;
 return {journal:context.window.FORME_NUTRITION_JOURNAL.create(storage,foods,core),data,foods,core};
}
test('journal calculates grams, persists entries and supports editing and deletion',()=>{
 const app=setup(),date='2026-11-07';
 assert.equal(app.journal.add(date,[{id:'chicken',grams:'100'},{id:'rice',grams:'100'}],'Lunch'),true);
 const entry=app.journal.entries(date)[0],expected=app.core.sumMeal(entry.items,app.foods);
 assert.equal(app.journal.day(date).kcal,expected.kcal);
 assert.equal(app.journal.day(date).count,1);
 assert.equal(app.journal.update(entry.id,date,[{id:'rice',grams:'200'}],'Dinner'),true);
 assert.equal(setup(app.data).journal.entries(date)[0].name,'Dinner');
 assert.equal(app.journal.day(date).kcal,app.core.sumMeal([{id:'rice',grams:'200'}],app.foods).kcal);
 assert.equal(app.journal.remove(entry.id),true);assert.equal(app.journal.day(date).count,0);
});
test('journal rejects unknown foods, invalid dates and amounts without changing data',()=>{
 const app=setup();assert.equal(app.journal.add('2026-02-30',[{id:'rice',grams:'100'}]),false);
 assert.equal(app.journal.add('2026-11-07',[{id:'unknown',grams:'100'}]),false);
 assert.equal(app.journal.add('2026-11-07',[{id:'rice',grams:'0'}]),false);
 assert.equal(app.journal.setGoal(-1,100),false);assert.equal(app.journal.entries().length,0);
});
