/* Versioned, local-only activity journal. Existing FORME storage keys remain readable. */
(function(root){
'use strict';
const key='forme-progress-v1';
const empty=()=>({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[]});
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&dateKey(new Date(value+'T12:00:00'))===value;
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value)&&value.length<=60;
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function normalizeSessions(list){
 if(!Array.isArray(list))return [];
 const seen=new Set(),result=[];
 for(const x of list){
  if(!plain(x)||!validId(x.id)||seen.has(x.id)||!validId(x.workoutId)||!validDate(x.date))continue;
  if(typeof x.minutes!=='number'||!Number.isFinite(x.minutes)||x.minutes<0||x.minutes>600)continue;
  seen.add(x.id);result.push({id:x.id,workoutId:x.workoutId,date:x.date,minutes:Math.round(x.minutes)});
 }
 return result;
}
function normalizeSets(list){
 if(!Array.isArray(list))return [];
 const seen=new Set(),result=[];
 for(const x of list){
  if(!plain(x)||!validId(x.id)||seen.has(x.id)||!validId(x.exerciseId)||!validDate(x.date))continue;
  if(!['reps','seconds'].includes(x.kind)||!Number.isInteger(x.value)||x.value<1||x.value>3600)continue;
  seen.add(x.id);result.push({id:x.id,exerciseId:x.exerciseId,date:x.date,kind:x.kind,value:x.value});
 }
 return result;
}
function read(storage){
 try{
  const parsed=JSON.parse(storage.getItem(key));
  if(plain(parsed)&&parsed.version===1){
   const g=plain(parsed.goal)?parsed.goal:{};
   return {
    version:1,
    goal:{
     workoutsPerWeek:Number.isInteger(g.workoutsPerWeek)&&g.workoutsPerWeek>=1&&g.workoutsPerWeek<=7?g.workoutsPerWeek:3,
     minutesPerWeek:Number.isInteger(g.minutesPerWeek)&&g.minutesPerWeek>=0&&g.minutesPerWeek<=2000?g.minutesPerWeek:90
    },
    sessions:normalizeSessions(parsed.sessions),
    sets:normalizeSets(parsed.sets)
   };
  }
 }catch{}
 return empty();
}
function create(storage){
 let state=read(storage);
 const copy=()=>JSON.parse(JSON.stringify(state));
 const persist=next=>{try{storage.setItem(key,JSON.stringify(next));state=next;return true;}catch{return false;}};
 const unique=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
 function recordWorkout(workoutId,date=dateKey(new Date()),minutes=0){
  if(!validId(workoutId)||!validDate(date)||typeof minutes!=='number'||!Number.isFinite(minutes)||minutes<0||minutes>600)return false;
  const next=copy();next.sessions.push({id:unique(),workoutId,date,minutes:Math.round(minutes)});return persist(next);
 }
 function recordSet(exerciseId,kind,value,date=dateKey(new Date())){
  if(!validId(exerciseId)||!['reps','seconds'].includes(kind)||!Number.isInteger(value)||value<1||value>3600||!validDate(date))return false;
  const next=copy();next.sets.push({id:unique(),exerciseId,kind,value,date});return persist(next);
 }
 function removeRecord(id){if(!validId(id))return false;const next=copy();next.sessions=next.sessions.filter(x=>x.id!==id);next.sets=next.sets.filter(x=>x.id!==id);if(next.sessions.length===state.sessions.length&&next.sets.length===state.sets.length)return false;return persist(next);}
 function setGoal(workoutsPerWeek,minutesPerWeek){if(!Number.isInteger(workoutsPerWeek)||workoutsPerWeek<1||workoutsPerWeek>7||!Number.isInteger(minutesPerWeek)||minutesPerWeek<0||minutesPerWeek>2000)return false;const next=copy();next.goal={workoutsPerWeek,minutesPerWeek};return persist(next);}
 function legacyCompletions(){try{const items=JSON.parse(storage.getItem('forme-completed-workouts'));if(!plain(items))return [];return Object.entries(items).filter(([date,item])=>validDate(date)&&plain(item)&&validId(item.id)).map(([date,item])=>({id:'legacy-'+date,workoutId:item.id,date,minutes:0,legacy:true}));}catch{return [];}}
 function sessions(){const current=[...state.sessions].reverse().filter(x=>validDate(x.date)&&validId(x.workoutId));const seen=new Set(current.map(x=>x.date+'|'+x.workoutId));return [...current,...legacyCompletions().filter(x=>!seen.has(x.date+'|'+x.workoutId))].sort((a,b)=>b.date.localeCompare(a.date));}
 function weekSummary(at=new Date()){const monday=new Date(at.getFullYear(),at.getMonth(),at.getDate());monday.setDate(monday.getDate()-(monday.getDay()+6)%7);const start=dateKey(monday);const end=new Date(monday);end.setDate(end.getDate()+6);const finish=dateKey(end);const matching=sessions().filter(x=>x.date>=start&&x.date<=finish);return {start,finish,workouts:matching.length,minutes:matching.reduce((sum,x)=>sum+x.minutes,0),sets:state.sets.filter(x=>x.date>=start&&x.date<=finish).length,goal:{...state.goal}};}
 return Object.freeze({get:copy,sessions,weekSummary,recordWorkout,recordSet,removeRecord,setGoal,key});
}
root.FORME_PROGRESS=Object.freeze({create,key,dateKey});
})(typeof window!=='undefined'?window:globalThis);
