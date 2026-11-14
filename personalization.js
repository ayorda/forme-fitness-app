/* Voluntary local preferences and deterministic plans. No inferred ability or medical diet. */
(function(root){
'use strict';
const key='forme-personal-v1';
const choices=Object.freeze({goal:['balanced','strength','mobility'],level:['beginner','intermediate'],equipment:['bar','mat','wall'],activities:['cal','yoga','mobility'],skills:['pullups','chinups','dips','muscleup','handstand']});
const copy=value=>JSON.parse(JSON.stringify(value));
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const subset=(value,allowed,min=0)=>Array.isArray(value)&&value.length>=min&&value.length<=allowed.length&&new Set(value).size===value.length&&value.every(x=>allowed.includes(x));
function validProfile(p){return object(p)&&choices.goal.includes(p.goal)&&choices.level.includes(p.level)&&subset(p.equipment,choices.equipment)&&Number.isInteger(p.days)&&p.days>=1&&p.days<=6&&Number.isInteger(p.minutes)&&p.minutes>=10&&p.minutes<=60&&subset(p.activities,choices.activities,1)&&subset(p.skills,choices.skills);}
function validSelection(value){return object(value)&&Object.keys(value).length<=3&&Object.entries(value).every(([id,n])=>['oat-bowl','lentil-bowl','tuna-toast'].includes(id)&&Number.isInteger(n)&&n>=1&&n<=8);}
function validDocument(value){return object(value)&&value.version===1&&(value.profile===null||validProfile(value.profile))&&validSelection(value.selection===undefined?{}:value.selection);}
function cleanProfile(p){return {goal:p.goal,level:p.level,equipment:[...p.equipment],days:p.days,minutes:p.minutes,activities:[...p.activities],skills:[...p.skills]};}
function create(storage){
 let value={version:1,profile:null,selection:{}};try{const saved=JSON.parse(storage.getItem(key));if(validDocument(saved))value={version:1,profile:saved.profile?cleanProfile(saved.profile):null,selection:{...saved.selection}};}catch{}
 const write=next=>{try{storage.setItem(key,JSON.stringify(next));value=next;return true;}catch{return false;}};
 return Object.freeze({get:()=>value.profile?copy(value.profile):null,selection:()=>copy(value.selection),save(profile){return validProfile(profile)&&write({...value,profile:cleanProfile(profile)});},setPortions(id,portions){if(!['oat-bowl','lentil-bowl','tuna-toast'].includes(id)||!Number.isInteger(portions)||portions<0||portions>8)return false;const selection={...value.selection};if(portions)selection[id]=portions;else delete selection[id];return write({...value,selection});},clear(){return write({...value,profile:null});}});
}
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function parseDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T12:00:00');return !Number.isNaN(d.getTime())&&dateKey(d)===value?d:null;}
function equipmentFor(workout,exercises){return [...new Set([workout.equip,...(workout.ids||[]).map(id=>exercises.find(x=>x.id===id)?.equip||'unknown')].filter(x=>x&&x!=='none'))];}
function recommend(profile,data,from,sessions=[],datePlans={}){
 const origin=parseDate(from);if(!validProfile(profile)||!origin)return {slots:[],adapted:false,observed:0,completed:0};
 const start=new Date(origin);start.setDate(start.getDate()+(8-start.getDay())%7);
 const historyStart=new Date(origin);historyStart.setDate(historyStart.getDate()-7);
 const prior=Object.entries(datePlans).filter(([date,id])=>parseDate(date)&&date>=dateKey(historyStart)&&date<from&&data.workouts.some(w=>w.id===id));
 const done=prior.filter(([date,id])=>sessions.some(s=>s.date===date&&s.workoutId===id));
 const adapted=prior.length>=2&&done.length/prior.length<.5;
 const level=adapted?'beginner':profile.level;
 const eligible=data.workouts.filter(w=>profile.activities.includes(w.cat)&&w.duration<=profile.minutes&&(w.level==='beginner'||(level==='intermediate'&&w.level==='intermediate'))&&equipmentFor(w,data.exercises).every(e=>profile.equipment.includes(e)));
 const preferred=profile.goal==='strength'||profile.skills.length?'cal':profile.goal==='mobility'?'mobility':null;
 eligible.sort((a,b)=>(b.cat===preferred)-(a.cat===preferred)||a.duration-b.duration||a.id.localeCompare(b.id));
 const slots=[];let previous=null,rotation=0;
 for(let week=0;week<4;week++)for(let i=0;i<profile.days;i++){
  const d=new Date(start);d.setDate(d.getDate()+week*7+Math.floor(i*7/profile.days));
  let pool=eligible;
  if(previous?.cat==='cal'&&Math.round((d-previous.date)/86400000)===1)pool=eligible.filter(w=>w.cat!=='cal');
  if(!pool.length)continue;
  const candidates=preferred&&i===0?pool.filter(w=>w.cat===preferred):pool;
  const available=candidates.length?candidates:pool;
  const chosen=available[rotation++%available.length];
  slots.push({date:dateKey(d),workoutId:chosen.id,week:week+1});previous={cat:chosen.cat,date:d};
 }
 return {start:dateKey(start),slots,adapted,observed:prior.length,completed:done.length};
}
function addFreeDates(slots,datePlans={},weeklyPlan={}){
 const next={...datePlans};let added=0;
 for(const slot of slots){const day=parseDate(slot.date);if(!day)continue;const weekday=['sun','mon','tue','wed','thu','fri','sat'][day.getDay()];
  if(Object.hasOwn(next,slot.date)||weeklyPlan[weekday])continue;
  if(Object.keys(next).length>=2000)break;
  next[slot.date]=slot.workoutId;added++;
 }
 return {datePlans:next,added};
}
const recipes=[
 {id:'oat-bowl',items:[{id:'oats',grams:'50'},{id:'greek',grams:'200'},{id:'banana',grams:'100'}]},
 {id:'lentil-bowl',items:[{id:'lentils',grams:'180'},{id:'rice',grams:'100'},{id:'tomato',grams:'100'},{id:'oliveoil',grams:'10'}]},
 {id:'tuna-toast',items:[{id:'tuna',grams:'120'},{id:'bread',grams:'80'},{id:'cucumber',grams:'100'}]}
];
function recipeItems(id,portions=1){const r=recipes.find(x=>x.id===id);if(!r||!Number.isInteger(portions)||portions<1||portions>8)return [];return r.items.map(x=>({id:x.id,grams:String(Number(x.grams)*portions)}));}
function shoppingList(selection){const totals=new Map();if(!object(selection))return [];for(const [id,portions]of Object.entries(selection))for(const item of recipeItems(id,portions))totals.set(item.id,(totals.get(item.id)||0)+Number(item.grams));return [...totals].map(([id,grams])=>({id,grams:String(grams)}));}
root.FORME_PERSONAL=Object.freeze({key,choices,validProfile,validDocument,create,recommend,addFreeDates,equipmentFor,recipeIds:recipes.map(x=>x.id),recipeItems,shoppingList});
})(typeof window!=='undefined'?window:globalThis);
