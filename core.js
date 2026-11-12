/* Pure functions are usable in the browser and by Node's built-in test runner. */
(function(root){
function validateGrams(raw){
 const value=String(raw??'').trim().replace(',','.');
 if(!/^(?:\d+)(?:\.\d+)?$/.test(value)) return {ok:false,reason:'format',message:'Въведи положително число за грамажа.'};
 const grams=Number(value);
 if(!Number.isFinite(grams)||grams<=0||grams>10000) return {ok:false,reason:'range',message:'Грамажът трябва да е между 0 и 10 000 г.'};
 return {ok:true,grams};
}
function calculateForGrams(food,grams){const m=grams/100;return {kcal:food.kcal*m,protein:food.protein*m,carbs:food.carbs*m,fat:food.fat*m,fiber:food.fiber*m};}
function sumMeal(items,foods){const total={kcal:0,protein:0,carbs:0,fat:0,fiber:0};let invalid=0;for(const item of items){const food=foods.find(f=>f.id===item.id),v=validateGrams(item.grams);if(!food||!v.ok){invalid++;continue;}const p=calculateForGrams(food,v.grams);for(const k in total)total[k]+=p[k];}return {...total,invalid};}
function mergeMealItems(items){const out=[],byFood=new Map();for(const item of items||[]){if(!item||typeof item.id!=='string')continue;const v=validateGrams(item.grams);if(!v.ok){out.push({...item});continue;}if(!byFood.has(item.id)){const merged={...item,grams:String(v.grams)};byFood.set(item.id,merged);out.push(merged);}else{const prev=byFood.get(item.id),sum=Math.round((Number(prev.grams)+v.grams)*100)/100;if(sum<=10000)prev.grams=String(sum);else out.push({...item});}}return out;}
function filterWorkouts(workouts,filters={}){const q=(filters.q||'').toLocaleLowerCase('bg').trim();return workouts.filter(w=>(!q||[w.name,w.tag,w.desc,w.searchText].join(' ').toLocaleLowerCase('bg').includes(q))&&(!filters.cat||w.cat===filters.cat)&&(!filters.level||w.level===filters.level)&&(!filters.maxTime||w.duration<=Number(filters.maxTime))&&(!filters.equip||w.equip===filters.equip));}
function filterExercises(exercises,filters){const q=(filters.q||'').toLocaleLowerCase('bg').trim();return exercises.filter(e=>(!q||[e.name,e.nameEn,e.nameDe,e.description,e.steps,e.muscles,e.searchText].join(' ').toLocaleLowerCase('bg').includes(q))&&(!filters.cat||e.cat===filters.cat)&&(!filters.level||e.level===filters.level)&&(!filters.equip||e.equip===filters.equip));}
function sortFoods(foods,sort=''){
 const list=[...(foods||[])];
 if(sort==='protein')return list.sort((a,b)=>b.protein-a.protein||a.kcal-b.kcal);
 if(sort==='kcalAsc')return list.sort((a,b)=>a.kcal-b.kcal||b.protein-a.protein);
 if(sort==='fiber')return list.sort((a,b)=>b.fiber-a.fiber||a.kcal-b.kcal);
 return list;
}
function filterFoods(foods,filters={}){const q=(filters.q||'').toLocaleLowerCase('bg').trim(),matched=foods.filter(f=>(!q||[f.name,f.state,f.info,f.searchText].join(' ').toLocaleLowerCase('bg').includes(q))&&(!filters.cat||f.cat===filters.cat));return filters.sort?sortFoods(matched,filters.sort):matched;}
function formatClock(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function workoutStreak(dates,todayKey){
 if(!Array.isArray(dates)||typeof todayKey!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(todayKey))return 0;
 const set=new Set(dates),toKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,cur=new Date(todayKey+'T12:00:00');
 if(Number.isNaN(cur.getTime()))return 0;
 if(!set.has(todayKey)){cur.setDate(cur.getDate()-1);if(!set.has(toKey(cur)))return 0;}
 let count=0;while(set.has(toKey(cur))){count++;cur.setDate(cur.getDate()-1);}return count;
}
const core={validateGrams,calculateForGrams,sumMeal,mergeMealItems,filterWorkouts,filterExercises,sortFoods,filterFoods,formatClock,workoutStreak};
if(typeof module!=='undefined'&&module.exports)module.exports=core;
root.FORME_CORE=core;
})(typeof window!=='undefined'?window:globalThis);
