/* Explicit JSON export/import of FORME user data with a rollback on failed writes. */
(function(root){
'use strict';
const keys=['forme-favorites','forme-plan','forme-date-plans','forme-completed-workouts','forme-current-meal','forme-saved-meals','forme-sound','forme-language','forme-user-v1','forme-progress-v1','forme-nutrition-v1'];
function exportData(storage){const data={};for(const key of keys){const value=storage.getItem(key);if(value!==null)data[key]=value;}return JSON.stringify({app:'FORME',version:1,exportedAt:new Date().toISOString(),data},null,2);}
function validObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T12:00:00');return !Number.isNaN(parsed.getTime())&&`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`===value;};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value);
const grams=value=>{const normalized=String(value??'').trim().replace(',','.');const amount=Number(normalized);return /^\d+(?:\.\d+)?$/.test(normalized)&&Number.isFinite(amount)&&amount>0&&amount<=10000;};
const items=value=>Array.isArray(value)&&value.every(x=>validObject(x)&&id(x.id)&&grams(x.grams));
const journalItems=value=>items(value)&&value.length>0&&value.length<=100;
function validate(payload){
 if(!validObject(payload)||payload.app!=='FORME'||payload.version!==1||!validObject(payload.data)||Object.keys(payload.data).some(k=>!keys.includes(k)))return false;
 for(const [key,value] of Object.entries(payload.data)){
  if(typeof value!=='string'||value.length>2_000_000)return false;
  if(key==='forme-language'){if(!['bg','en','de'].includes(value))return false;continue;}
  let parsed;try{parsed=JSON.parse(value);}catch{return false;}
  if(key==='forme-sound'){if(typeof parsed!=='boolean')return false;}
  else if(key==='forme-favorites'){if(!validObject(parsed)||!Array.isArray(parsed.exercises)||!Array.isArray(parsed.workouts)||![...parsed.exercises,...parsed.workouts].every(x=>typeof x==='string'))return false;}
  else if(key==='forme-plan'||key==='forme-date-plans'){if(!validObject(parsed)||!Object.values(parsed).every(x=>typeof x==='string'))return false;}
  else if(key==='forme-completed-workouts'){if(!validObject(parsed)||!Object.values(parsed).every(x=>validObject(x)&&typeof x.id==='string'&&typeof x.name==='string'))return false;}
  else if(key==='forme-user-v1'){if(parsed?.version!==1||!validObject(parsed.records)||Object.entries(parsed.records).some(([name,raw])=>!['favorites','plan','date-plans','completed-workouts','current-meal','saved-meals','sound'].includes(name)||!validate({app:'FORME',version:1,data:{['forme-'+name]:raw}})))return false;}
  else if(key==='forme-current-meal'){if(!items(parsed))return false;}
  else if(key==='forme-saved-meals'){if(!Array.isArray(parsed)||!parsed.every(x=>validObject(x)&&typeof x.name==='string'&&items(x.items)))return false;}
  else if(key==='forme-progress-v1'){if(parsed?.version!==1||!Array.isArray(parsed.sessions)||!Array.isArray(parsed.sets)||!Number.isInteger(parsed.goal?.workoutsPerWeek)||parsed.goal.workoutsPerWeek<1||parsed.goal.workoutsPerWeek>7||!Number.isInteger(parsed.goal?.minutesPerWeek)||parsed.goal.minutesPerWeek<0||parsed.goal.minutesPerWeek>2000||!parsed.sessions.every(x=>validObject(x)&&id(x.id)&&id(x.workoutId)&&date(x.date)&&Number.isFinite(x.minutes)&&x.minutes>=0&&x.minutes<=600)||!parsed.sets.every(x=>validObject(x)&&id(x.id)&&id(x.exerciseId)&&date(x.date)&&['reps','seconds'].includes(x.kind)&&Number.isInteger(x.value)&&x.value>=1&&x.value<=3600))return false;}
  else if(key==='forme-nutrition-v1'){if(parsed?.version!==1||!Array.isArray(parsed.entries)||!Number.isInteger(parsed.goal?.kcal)||parsed.goal.kcal<1||parsed.goal.kcal>10000||!Number.isInteger(parsed.goal?.protein)||parsed.goal.protein<0||parsed.goal.protein>1000||!parsed.entries.every(x=>validObject(x)&&id(x.id)&&date(x.date)&&typeof x.name==='string'&&x.name.length<=70&&journalItems(x.items)))return false;}
  else if(!validObject(parsed))return false;
 }
 return true;
}
function importData(storage,text){let parsed;try{parsed=JSON.parse(text);}catch{return false;}if(!validate(parsed))return false;
 const prior={};try{for(const key of keys)prior[key]=storage.getItem(key);for(const key of keys){if(Object.hasOwn(parsed.data,key))storage.setItem(key,parsed.data[key]);else storage.removeItem(key);}return true;}
 catch{for(const key of keys)try{if(prior[key]===null)storage.removeItem(key);else if(prior[key]!==undefined)storage.setItem(key,prior[key]);}catch{}return false;}
}
root.FORME_BACKUP=Object.freeze({keys,exportData,importData,validate});
})(typeof window!=='undefined'?window:globalThis);
