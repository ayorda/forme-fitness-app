/* Pure functions are usable in the browser and by Node's built-in test runner. */
(function(root){
const levelRank={beginner:1,intermediate:2,advanced:3};
function validateGrams(raw){
 const value=String(raw??'').trim().replace(',','.');
 if(!/^(?:\d+)(?:\.\d+)?$/.test(value)) return {ok:false,message:'Въведи положително число за грамажа.'};
 const grams=Number(value);
 if(!Number.isFinite(grams)||grams<=0||grams>10000) return {ok:false,message:'Грамажът трябва да е между 0 и 10 000 г.'};
 return {ok:true,grams};
}
function calculateForGrams(food,grams){const m=grams/100;return {kcal:food.kcal*m,protein:food.protein*m,carbs:food.carbs*m,fat:food.fat*m,fiber:food.fiber*m};}
function sumMeal(items,foods){const total={kcal:0,protein:0,carbs:0,fat:0,fiber:0};let invalid=0;for(const item of items){const food=foods.find(f=>f.id===item.id),v=validateGrams(item.grams);if(!food||!v.ok){invalid++;continue;}const p=calculateForGrams(food,v.grams);for(const k in total)total[k]+=p[k];}return {...total,invalid};}
function filterWorkouts(workouts,filters){return workouts.filter(w=>(!filters.cat||w.cat===filters.cat)&&(!filters.level||w.level===filters.level)&&(!filters.maxTime||w.duration<=Number(filters.maxTime))&&(!filters.equip||w.equip===filters.equip));}
function filterExercises(exercises,filters){const q=(filters.q||'').toLocaleLowerCase('bg').trim();return exercises.filter(e=>(!q||[e.name,e.description,e.steps].join(' ').toLocaleLowerCase('bg').includes(q))&&(!filters.cat||e.cat===filters.cat)&&(!filters.level||e.level===filters.level)&&(!filters.equip||e.equip===filters.equip));}
function formatClock(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
const core={validateGrams,calculateForGrams,sumMeal,filterWorkouts,filterExercises,formatClock,levelRank};
if(typeof module!=='undefined'&&module.exports)module.exports=core;
root.FORME_CORE=core;
})(typeof window!=='undefined'?window:globalThis);
