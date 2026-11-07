/* Explicit JSON export/import of FORME user data with a rollback on failed writes. */
(function(root){
'use strict';
const keys=['forme-favorites','forme-plan','forme-date-plans','forme-completed-workouts','forme-current-meal','forme-saved-meals','forme-sound','forme-language','forme-user-v1','forme-progress-v1','forme-nutrition-v1'];
function exportData(storage){const data={};for(const key of keys){const value=storage.getItem(key);if(value!==null)data[key]=value;}return JSON.stringify({app:'FORME',version:1,exportedAt:new Date().toISOString(),data},null,2);}
function validObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T12:00:00');return !Number.isNaN(parsed.getTime())&&`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`===value;};
const items=value=>Array.isArray(value)&&value.every(x=>validObject(x)&&typeof x.id==='string'&&/^[\w-]+$/.test(x.id)&&Number.isFinite(Number(x.grams))&&Number(x.grams)>0&&Number(x.grams)<=10000);
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
  else if(key==='forme-user-v1'){if(parsed?.version!==1||!validObject(parsed.records)||Object.entries(parsed.records).some(([name,raw])=>!['favorites','plan','date-plans','completed-workouts','current-meal','saved-meals','sound'].includes(name)||typeof raw!=='string'))return false;}
  else if(key==='forme-current-meal'){if(!items(parsed))return false;}
  else if(key==='forme-saved-meals'){if(!Array.isArray(parsed)||!parsed.every(x=>validObject(x)&&typeof x.name==='string'&&items(x.items)))return false;}
  else if(key==='forme-progress-v1'){if(parsed?.version!==1||!Array.isArray(parsed.sessions)||!Array.isArray(parsed.sets)||!Number.isInteger(parsed.goal?.workoutsPerWeek)||!Number.isInteger(parsed.goal?.minutesPerWeek)||!parsed.sessions.every(x=>validObject(x)&&typeof x.id==='string'&&typeof x.workoutId==='string'&&date(x.date)&&Number.isFinite(x.minutes))||!parsed.sets.every(x=>validObject(x)&&typeof x.id==='string'&&typeof x.exerciseId==='string'&&date(x.date)&&['reps','seconds'].includes(x.kind)&&Number.isInteger(x.value)))return false;}
  else if(key==='forme-nutrition-v1'){if(parsed?.version!==1||!Array.isArray(parsed.entries)||!Number.isInteger(parsed.goal?.kcal)||!Number.isInteger(parsed.goal?.protein)||!parsed.entries.every(x=>validObject(x)&&typeof x.id==='string'&&date(x.date)&&typeof x.name==='string'&&items(x.items)))return false;}
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
