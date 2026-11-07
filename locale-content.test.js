const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const c={window:{}};vm.createContext(c);
for(const f of ['exercise-art.js','data.js','core.js','exercise-translations.js','food-translations.js','workout-translations.js','interface-translations.js','locale-content.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const api=c.window.FORME_LOCALE_CONTENT,data=c.window.FORME_DATA,core=c.window.FORME_CORE;
test('translated foods retain their IDs, exact nutrient data and reference links',()=>{
 for(const food of data.foods)for(const lang of ['bg','en','de']){
  const result=api.translateContent('food',food,lang);assert.ok(result,food.id+' '+lang);assert.equal(result.id,food.id);assert.equal(result.kcal,food.kcal);assert.equal(result.protein,food.protein);assert.equal(result.sourceDetails,food.sourceDetails);
 }
 const before=core.sumMeal([{id:'chicken',grams:200},{id:'rice',grams:150}],data.foods);
 const translated=data.foods.map(food=>api.translateContent('food',food,'de'));
 const after=core.sumMeal([{id:'chicken',grams:200},{id:'rice',grams:150}],translated);
 assert.equal(after.kcal,before.kcal);assert.equal(after.kcal,435);
});
test('exercise and workout translations preserve IDs, relationships and original records',()=>{
 for(const ex of data.exercises)for(const lang of ['en','de']){const result=api.translateContent('exercise',ex,lang);assert.ok(result,ex.id+' '+lang);assert.equal(result.id,ex.id);assert.equal(result.photo,ex.photo);assert.notEqual(result,ex);}
 for(const workout of data.workouts)for(const lang of ['bg','en','de']){const result=api.translateContent('workout',workout,lang);assert.ok(result,workout.id+' '+lang);assert.equal(result.id,workout.id);assert.deepEqual(result.ids,workout.ids);assert.notEqual(result.ids,workout.ids);assert.equal(result.rounds,workout.rounds);}
 assert.equal(data.foods.find(f=>f.id==='rice').name,'Бял ориз');
});
test('unsupported languages, kinds and missing content return no result',()=>{
 assert.equal(api.translateContent('food',data.foods[0],'fr'),null);
 assert.equal(api.translateContent('missing',data.foods[0],'de'),null);
 assert.equal(api.translateContent('food',{id:'unknown'},'de'),null);
 assert.equal(api.translateText('not-translated','en'),null);
 assert.equal(api.translateText('plan.recorded','en',{workout:'Training'}),'Marked as completed: Training');
});
