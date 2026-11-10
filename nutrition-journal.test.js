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

test('a cleared date never sums the whole history and the week view follows the chosen date',()=>{
 const app=setup(),first='2026-11-01',second='2026-11-02';
 assert.equal(app.journal.add(first,[{id:'rice',grams:'100'}]),true);
 assert.equal(app.journal.add(second,[{id:'rice',grams:'200'}]),true);
 const oneDay=app.journal.day(first).kcal;
 assert.equal(app.journal.day(second).kcal,oneDay*2);
 assert.equal(app.journal.day('').count,0);assert.equal(app.journal.day('').kcal,0);
 assert.equal(app.journal.day('').validDate,false);assert.equal(app.journal.day('2026-02-30').count,0);
 assert.equal(app.journal.entries().length,2);
 assert.equal(app.journal.day(first).validDate,true);
 const week=app.journal.week(second);
 assert.equal(week.length,7);assert.equal(week[6].date,second);
 assert.equal(week[5].date,first);assert.equal(week[5].kcal,oneDay);assert.equal(week[6].kcal,oneDay*2);
 assert.equal(app.journal.week('bad date').length,7);
});

test('corrupted nutrition journal storage repairs goals, null items and non-string names',()=>{
 const date='2026-11-07';
 const app=setup({'forme-nutrition-v1':JSON.stringify({
  version:1,
  goal:{kcal:-10,protein:5000},
  entries:[
   null,
   {id:'null-item',date,name:'Bad',items:[null]},
   {id:'',date,name:'Empty id',items:[{id:'rice',grams:'100'}]},
   {id:'valid-1',date,name:{broken:true},items:[{id:'rice',grams:150}]}
  ]
 })});
 const summary=app.journal.day(date);
 assert.equal(summary.goal.kcal,2000);
 assert.equal(summary.goal.protein,100);
 assert.equal(summary.count,1);
 assert.equal(summary.kcal,195);
 assert.equal(app.journal.entries(date)[0].name,'');
 assert.equal(app.journal.entries(date)[0].items[0].grams,'150');
});
