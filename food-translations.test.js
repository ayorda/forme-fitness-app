const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};vm.createContext(context);
for(const file of ['exercise-art.js','data.js','core.js','food-translations.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
test('all foods have names, preparation states and descriptions in English and German',()=>{
 for(const food of context.window.FORME_DATA.foods)for(const language of ['en','de']){
  const translated=context.window.FORME_FOOD_TRANSLATIONS.get(food.id,language);assert.ok(translated,food.id+' '+language);
  for(const field of ['name','state','info'])assert.ok(typeof translated[field]==='string'&&translated[field].trim(),food.id+' '+language+' '+field);
 }
});
test('cooked rice and raw chicken retain their reference states and nutritional values',()=>{
 const api=context.window.FORME_FOOD_TRANSLATIONS,foods=context.window.FORME_DATA.foods,core=context.window.FORME_CORE;
 assert.match(api.get('rice','en').state,/cooked/);assert.match(api.get('rice','de').state,/gekocht/);
 assert.match(api.get('chicken','en').state,/raw/);assert.match(api.get('chicken','de').state,/roh/);
 const meal=core.sumMeal([{id:'chicken',grams:200},{id:'rice',grams:150}],foods);assert.equal(meal.kcal,435);
 assert.equal(api.get('rice','fr'),null);assert.equal(api.get('unknown','en'),null);
});
