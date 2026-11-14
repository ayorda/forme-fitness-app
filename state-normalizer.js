/* Normalizes the local user state before the interface renders it.
   Storage can hold data from older versions or from manual edits, so every
   value is checked for its expected shape and silently repaired. */
(function(root){
'use strict';
const bool=value=>value===true;
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&dateKey(new Date(value+'T12:00:00'))===value;
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value)&&value.length<=60;
function grams(value){
 if(typeof value!=='string'&&typeof value!=='number')return false;
 const raw=String(value).trim().replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(raw))return false;
 const amount=Number(raw);
 return Number.isFinite(amount)&&amount>0&&amount<=10000;
}
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function uniqueStrings(value,allowed){
 if(!Array.isArray(value))return [];
 const seen=new Set();
 return value.slice(0,500).filter(item=>{
  if(typeof item!=='string'||!id(item)||seen.has(item))return false;
  seen.add(item);
  return !allowed||allowed(item);
 });
}
function favorites(value,known){
 if(!plain(value))return {exercises:[],workouts:[]};
 const foods=uniqueStrings(value.foods,item=>!known?.foods||known.foods.has(item));
 return {
  exercises:uniqueStrings(value.exercises,item=>!known?.exercises||known.exercises.has(item)),
  workouts:uniqueStrings(value.workouts,item=>!known?.workouts||known.workouts.has(item)),
  ...(foods.length?{foods}:{})
 };
}
function plan(value,known){
 if(!plain(value))return {};
 const next={};
 for(const day of ['mon','tue','wed','thu','fri','sat','sun']){
  const workout=value[day];
  if(typeof workout!=='string'||!id(workout))continue;
  if(known&&!known.workouts.has(workout))continue;
  next[day]=workout;
 }
 return next;
}
function datePlans(value,known){
 if(!plain(value))return {};
 const next={};
 for(const [date,workout] of Object.entries(value).slice(0,2000)){
  if(!validDate(date))continue;
  if(workout===''){next[date]='';continue;}
  if(typeof workout!=='string'||!id(workout))continue;
  if(known&&!known.workouts.has(workout))continue;
  next[date]=workout;
 }
 return next;
}
function completed(value){
 if(!plain(value))return {};
 const next={};
 for(const [date,record] of Object.entries(value).slice(0,2000)){
  if(!validDate(date)||!plain(record))continue;
  if(typeof record.id!=='string'||!id(record.id))continue;
  if(typeof record.name!=='string')continue;
  const name=record.name.trim();
  if(!name||name.length>120)continue;
  next[date]={id:record.id,name};
 }
 return next;
}
function meal(value,known){
 if(!Array.isArray(value))return [];
 if(value.length>100)value=value.slice(0,100);
 return value.filter(item=>{
  if(!plain(item)||typeof item.id!=='string'||!id(item.id))return false;
  if(!grams(item.grams))return false;
  return !known?.foods||known.foods.has(item.id);
 }).map(item=>({id:item.id,grams:String(item.grams)}));
}
function mealItems(value,known){
 return Array.isArray(value)&&value.length>0?meal(value,known):[];
}
function savedMeals(value,known){
 if(!Array.isArray(value))return [];
 return value.slice(0,200).filter(item=>{
  if(!plain(item)||typeof item.name!=='string')return false;
  const trimmed=item.name.trim();
  if(!trimmed||trimmed.length>70)return false;
  return mealItems(item.items,known).length>0;
 }).map(item=>{const base={name:item.name.trim(),items:mealItems(item.items,known)};return typeof item.tag==='string'&&/^[a-z]{2,12}$/.test(item.tag)?{...base,tag:item.tag}:base;});
}
function sound(value){return value===false?false:true;}
function create(known={}){
 const knownFoods=known.foods?new Set(known.foods):null;
 const knownWorkouts=known.workouts?new Set(known.workouts):null;
 const knownExercises=known.exercises?new Set(known.exercises):null;
 const catalog={foods:knownFoods,workouts:knownWorkouts,exercises:knownExercises};
 return Object.freeze({
  favorites:value=>favorites(value,catalog),
  plan:value=>plan(value,catalog),
  datePlans:value=>datePlans(value,catalog),
  completed,
  meal:value=>meal(value,catalog),
  savedMeals:value=>savedMeals(value,catalog),
  sound,
  validDate,
  grams,
  gramsValue:value=>String(value??'').trim().replace(',','.')
 });
}
const api=Object.freeze({create,validDate,grams});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.FORME_STATE_NORMALIZER=api;
})(typeof window!=='undefined'?window:globalThis);
