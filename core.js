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
function gramsForTargetProtein(food,targetProtein=25){
 const p=Number(food?.protein),t=Number(targetProtein);
 if(!Number.isFinite(p)||p<=0||!Number.isFinite(t)||t<=0)return null;
 const grams=Math.round(t/p*100);
 return grams>=1&&grams<=10000?grams:null;
}
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
function longestWorkoutStreak(dates){
 if(!Array.isArray(dates)||!dates.length)return 0;
 const toKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const unique=[...new Set(dates.filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
 let best=0,cur=0,prevKey='';
 for(const key of unique){
  const dt=new Date(key+'T12:00:00');
  if(Number.isNaN(dt.getTime())||toKey(dt)!==key)continue;
  const prev=new Date(dt);prev.setDate(prev.getDate()-1);
  cur=toKey(prev)===prevKey?cur+1:1;
  if(cur>best)best=cur;
  prevKey=key;
 }
 return best;
}
function summarizeAllTimeProgress(sessions,sets){
 const sList=Array.isArray(sessions)?sessions:[],stList=Array.isArray(sets)?sets:[];
 const counts=new Map();let totalMinutes=0;
 for(const s of sList){totalMinutes+=Math.max(0,Number(s?.minutes)||0);if(typeof s?.workoutId==='string'&&s.workoutId)counts.set(s.workoutId,(counts.get(s.workoutId)||0)+1);}
 let topWorkoutId=null,topWorkoutCount=0;
 for(const [wid,cnt] of counts)if(cnt>topWorkoutCount){topWorkoutId=wid;topWorkoutCount=cnt;}
 return {totalWorkouts:sList.length,totalMinutes:Math.round(totalMinutes),totalSets:stList.length,topWorkoutId,topWorkoutCount};
}
function exerciseProgressDelta(sets,exerciseId,kind){
 const list=(Array.isArray(sets)?sets:[]).filter(s=>s?.exerciseId===exerciseId&&s?.kind===kind&&Number.isFinite(Number(s?.value)));
 if(list.length<2)return null;
 const chrono=[...list].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
 const first=Number(chrono[0].value),best=chrono.reduce((m,s)=>Math.max(m,Number(s.value)),0);
 return {first,best,gain:best-first,count:chrono.length};
}
function relatedExercises(exercises,currentId,limit=3){
 const list=Array.isArray(exercises)?exercises:[],cur=list.find(e=>e?.id===currentId);
 if(!cur)return [];
 const rank=lvl=>({beginner:0,intermediate:1,advanced:2,elite:3}[lvl]??1);
 const words=s=>new Set(String(s||'').toLocaleLowerCase('bg').split(/[^a-zа-я0-9]+/i).filter(w=>w.length>3));
 const curWords=words(cur.muscles),curRank=rank(cur.level);
 const scored=list.filter(e=>e&&e.id!==currentId&&e.cat===cur.cat).map(e=>{
  let overlap=0;for(const w of words(e.muscles))if(curWords.has(w))overlap++;
  const levelDiff=Math.abs(rank(e.level)-curRank),sameEquip=e.equip===cur.equip?1:0;
  return {e,score:overlap*3+sameEquip*2-levelDiff*2};
 }).sort((a,b)=>b.score-a.score);
 const picked=scored.slice(0,limit).map(x=>x.e);
 if(cur.equip!=='none'&&picked.length&&!picked.some(x=>x.equip==='none')){
  const bw=scored.find(x=>x.e.equip==='none')?.e;
  if(bw)picked[picked.length-1]=bw;
 }
 return picked;
}
function relatedFoods(foods,currentId,limit=3){
 const list=Array.isArray(foods)?foods:[],cur=list.find(f=>f?.id===currentId);
 if(!cur)return [];
 const curDens=cur.protein/Math.max(1,cur.kcal);
 return list.filter(f=>f&&f.id!==currentId&&f.cat===cur.cat).sort((a,b)=>Math.abs(a.protein/Math.max(1,a.kcal)-curDens)-Math.abs(b.protein/Math.max(1,b.kcal)-curDens)||Math.abs(a.kcal-cur.kcal)-Math.abs(b.kcal-cur.kcal)).slice(0,limit);
}
function exportActivityCsv({sessions=[],sets=[],nutritionEntries=[]}={}){
 const cell=val=>{if(val===null||val===undefined||val==='')return '';let s=String(val);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
 const round1=n=>Number.isFinite(Number(n))?Math.round(Number(n)*10)/10:'';
 const rows=[
  ...(Array.isArray(sessions)?sessions:[]).map(s=>({date:String(s?.date||''),cols:[s?.date,'workout',s?.title||s?.workoutId||'','minutes',round1(s?.minutes),'','','','','']})),
  ...(Array.isArray(sets)?sets:[]).map(s=>({date:String(s?.date||''),cols:[s?.date,'set',s?.title||s?.exerciseId||'',s?.kind||'reps',round1(s?.value),'','','','','']})),
  ...(Array.isArray(nutritionEntries)?nutritionEntries:[]).map(e=>({date:String(e?.date||''),cols:[e?.date,'nutrition',e?.title||'','meal',round1(e?.itemsCount),round1(e?.kcal),round1(e?.protein),round1(e?.carbs),round1(e?.fat),round1(e?.fiber)]}))
 ].sort((a,b)=>b.date.localeCompare(a.date));
 const head='date,type,name,metric,value,kcal,protein_g,carbs_g,fat_g,fiber_g';
 return '\uFEFF'+[head,...rows.map(r=>r.cols.map(cell).join(','))].join('\r\n')+'\r\n';
}
function shiftWeeklyPlan(plan={},dayKeys=['mon','tue','wed','thu','fri','sat','sun'],delta=1){
 const keys=Array.isArray(dayKeys)&&dayKeys.length?dayKeys:['mon','tue','wed','thu','fri','sat','sun'],n=keys.length,step=Number.isInteger(delta)?delta:1,out={};
 keys.forEach((key,i)=>{const src=keys[((i-step)%n+n)%n],val=plan?.[src];if(typeof val==='string'&&val)out[key]=val;});
 return out;
}
function topLoggedFoods(entries=[],limit=4){
 const map=new Map(),sorted=[...(Array.isArray(entries)?entries:[])].sort((a,b)=>String(b?.date||'').localeCompare(String(a?.date||'')));
 for(const entry of sorted){
  for(const item of Array.isArray(entry?.items)?entry.items:[]){
   const id=typeof item?.id==='string'?item.id:'',v=validateGrams(item?.grams);
   if(!id||!v.ok)continue;
   const prev=map.get(id);
   if(prev)prev.count+=1;
   else map.set(id,{id,count:1,grams:String(v.grams)});
  }
 }
 return [...map.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id)).slice(0,Math.max(1,Number(limit)||4));
}
const core={validateGrams,calculateForGrams,gramsForTargetProtein,macroCalorieShares,sumMeal,mergeMealItems,scaleMealItems,summarizeNutritionWeek,summarizeAllTimeProgress,exerciseProgressDelta,relatedExercises,relatedFoods,exportActivityCsv,shiftWeeklyPlan,topLoggedFoods,sortWorkouts,filterWorkouts,sortExercises,filterExercises,sortFoods,filterFoods,formatClock,workoutStreak,longestWorkoutStreak};
if(typeof module!=='undefined'&&module.exports)module.exports=core;
root.FORME_CORE=core;
})(typeof window!=='undefined'?window:globalThis);
