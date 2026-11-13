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
function macroCalorieShares(totals){
 const p=Math.max(0,Number(totals?.protein)||0)*4,c=Math.max(0,Number(totals?.carbs)||0)*4,f=Math.max(0,Number(totals?.fat)||0)*9,sum=p+c+f;
 if(sum<=0)return {proteinPct:0,carbsPct:0,fatPct:0};
 const proteinPct=Math.round(p/sum*100),carbsPct=Math.round(c/sum*100),fatPct=Math.max(0,100-proteinPct-carbsPct);
 return {proteinPct,carbsPct,fatPct};
}
function sumMeal(items,foods){const total={kcal:0,protein:0,carbs:0,fat:0,fiber:0};let invalid=0;for(const item of items){const food=foods.find(f=>f.id===item.id),v=validateGrams(item.grams);if(!food||!v.ok){invalid++;continue;}const p=calculateForGrams(food,v.grams);for(const k in total)total[k]+=p[k];}return {...total,invalid};}
function mergeMealItems(items){const out=[],byFood=new Map();for(const item of items||[]){if(!item||typeof item.id!=='string')continue;const v=validateGrams(item.grams);if(!v.ok){out.push({...item});continue;}if(!byFood.has(item.id)){const merged={...item,grams:String(v.grams)};byFood.set(item.id,merged);out.push(merged);}else{const prev=byFood.get(item.id),sum=Math.round((Number(prev.grams)+v.grams)*100)/100;if(sum<=10000)prev.grams=String(sum);else out.push({...item});}}return out;}
function scaleMealItems(items,factor){
 const m=Number(factor);if(!Number.isFinite(m)||m<=0)return [...(items||[])];
 return (items||[]).map(item=>{if(!item||typeof item.id!=='string')return item;const v=validateGrams(item.grams);if(!v.ok)return {...item};const scaled=Math.round(v.grams*m*10)/10;return scaled>0&&scaled<=10000?{...item,grams:String(scaled)}:{...item};});
}
function summarizeNutritionWeek(week,goal){
 const active=(week||[]).filter(d=>Number(d?.kcal)>0);
 if(!active.length)return {loggedDays:0,avgKcal:0,avgProtein:0,proteinGoalDays:0};
 const sumKcal=active.reduce((s,d)=>s+(Number(d.kcal)||0),0),sumProt=active.reduce((s,d)=>s+(Number(d.protein)||0),0),pGoal=Number(goal?.protein)||0;
 return {loggedDays:active.length,avgKcal:Math.round(sumKcal/active.length),avgProtein:Math.round(sumProt/active.length*10)/10,proteinGoalDays:pGoal>0?active.filter(d=>(Number(d.protein)||0)>=pGoal).length:0};
}
const levelOrder={beginner:0,intermediate:1,advanced:2,elite:3};
function sortWorkouts(workouts,sort=''){
 const list=[...(workouts||[])];
 if(sort==='durationAsc')return list.sort((a,b)=>a.duration-b.duration);
 if(sort==='durationDesc')return list.sort((a,b)=>b.duration-a.duration);
 if(sort==='levelAsc')return list.sort((a,b)=>(levelOrder[a.level]??9)-(levelOrder[b.level]??9)||a.duration-b.duration);
 return list;
}
function filterWorkouts(workouts,filters={}){const q=(filters.q||'').toLocaleLowerCase('bg').trim(),matched=workouts.filter(w=>(!q||[w.name,w.tag,w.desc,w.searchText].join(' ').toLocaleLowerCase('bg').includes(q))&&(!filters.cat||w.cat===filters.cat)&&(!filters.level||w.level===filters.level)&&(!filters.maxTime||w.duration<=Number(filters.maxTime))&&(!filters.equip||w.equip===filters.equip));return filters.sort?sortWorkouts(matched,filters.sort):matched;}
function sortExercises(exercises,sort='',locale='bg'){
 const list=[...(exercises||[])];
 if(sort==='levelAsc')return list.sort((a,b)=>(levelOrder[a.level]??9)-(levelOrder[b.level]??9)||String(a.name||'').localeCompare(String(b.name||''),locale));
 if(sort==='levelDesc')return list.sort((a,b)=>(levelOrder[b.level]??-1)-(levelOrder[a.level]??-1)||String(a.name||'').localeCompare(String(b.name||''),locale));
 if(sort==='nameAsc')return list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),locale));
 return list;
}
function filterExercises(exercises,filters={},locale='bg'){const q=(filters.q||'').toLocaleLowerCase('bg').trim(),matched=exercises.filter(e=>(!q||[e.name,e.nameEn,e.nameDe,e.description,e.steps,e.muscles,e.searchText].join(' ').toLocaleLowerCase('bg').includes(q))&&(!filters.cat||e.cat===filters.cat)&&(!filters.level||e.level===filters.level)&&(!filters.equip||e.equip===filters.equip));return filters.sort?sortExercises(matched,filters.sort,locale):matched;}
function sortFoods(foods,sort=''){
 const list=[...(foods||[])];
 if(sort==='protein')return list.sort((a,b)=>b.protein-a.protein||a.kcal-b.kcal);
 if(sort==='proteinDensity')return list.sort((a,b)=>(b.protein/Math.max(1,b.kcal))-(a.protein/Math.max(1,a.kcal))||b.protein-a.protein);
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
const core={validateGrams,calculateForGrams,macroCalorieShares,sumMeal,mergeMealItems,scaleMealItems,summarizeNutritionWeek,sortWorkouts,filterWorkouts,sortExercises,filterExercises,sortFoods,filterFoods,formatClock,workoutStreak};
if(typeof module!=='undefined'&&module.exports)module.exports=core;
root.FORME_CORE=core;
})(typeof window!=='undefined'?window:globalThis);
