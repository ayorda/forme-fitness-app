/* Voluntary sleep diary. Estimates and self-ratings are not a medical recovery score. */
(function(root){
'use strict';
const key='forme-recovery-v1',groups=Object.freeze(['unspecified','teen','adult','older']);
const empty=()=>({version:1,ageGroup:'unspecified',entries:[]});
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const clock=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,60}$/.test(value);
const offset=value=>Number.isInteger(value)&&value>=-840&&value<=840;
function duration(entry){
 if(!plain(entry)||!validDate(entry.date)||!validTime(entry.bedtime)||!validTime(entry.wakeTime)||entry.bedtime===entry.wakeTime||!offset(entry.bedOffset)||!offset(entry.wakeOffset)||!Number.isInteger(entry.awakeMinutes)||entry.awakeMinutes<0)return null;
 const bed=clock(entry.bedtime),wake=clock(entry.wakeTime),minutes=wake-bed+(bed>wake?1440:0)+entry.wakeOffset-entry.bedOffset;
 if(minutes<=0||minutes>1440||entry.awakeMinutes>=minutes)return null;
 return {inBedMinutes:minutes,sleepMinutes:minutes-entry.awakeMinutes};
}
function validEntry(entry){return plain(entry)&&validId(entry.id)&&duration(entry)!==null&&Number.isInteger(entry.quality)&&entry.quality>=1&&entry.quality<=5&&Number.isInteger(entry.fatigue)&&entry.fatigue>=1&&entry.fatigue<=5;}
function validDocument(value){
 if(!plain(value)||value.version!==1||!groups.includes(value.ageGroup)||!Array.isArray(value.entries)||value.entries.length>5000)return false;
 const ids=new Set(),dates=new Set();
 for(const entry of value.entries){if(!validEntry(entry)||ids.has(entry.id)||dates.has(entry.date))return false;ids.add(entry.id);dates.add(entry.date);}
 return true;
}
const cleanEntry=entry=>({id:entry.id,date:entry.date,bedtime:entry.bedtime,wakeTime:entry.wakeTime,bedOffset:entry.bedOffset,wakeOffset:entry.wakeOffset,awakeMinutes:entry.awakeMinutes,quality:entry.quality,fatigue:entry.fatigue});
function normalize(value){
 const result=empty();if(!plain(value)||value.version!==1)return result;
 if(groups.includes(value.ageGroup))result.ageGroup=value.ageGroup;
 const ids=new Set(),dates=new Set();
 for(const entry of Array.isArray(value.entries)?value.entries.slice(0,5000):[]){
  if(!validEntry(entry)||ids.has(entry.id)||dates.has(entry.date))continue;
  ids.add(entry.id);dates.add(entry.date);result.entries.push(cleanEntry(entry));
 }
 return result;
}
function prepare(input){
 if(!plain(input)||!validDate(input.date)||!validTime(input.bedtime)||!validTime(input.wakeTime)||input.bedtime===input.wakeTime||!Number.isInteger(input.awakeMinutes)||input.awakeMinutes<0)return null;
 const [year,month,day]=input.date.split('-').map(Number),bedMinutes=clock(input.bedtime),wakeMinutes=clock(input.wakeTime),bedDay=new Date(Date.UTC(year,month-1,day-(bedMinutes>wakeMinutes?1:0),12));
 const bed=new Date(bedDay.getUTCFullYear(),bedDay.getUTCMonth(),bedDay.getUTCDate(),Math.floor(bedMinutes/60),bedMinutes%60),wake=new Date(year,month-1,day,Math.floor(wakeMinutes/60),wakeMinutes%60);
 // A clock time skipped by the spring DST change must not silently shift forward.
 if(bed.getHours()*60+bed.getMinutes()!==bedMinutes||wake.getHours()*60+wake.getMinutes()!==wakeMinutes)return null;
 const entry={date:input.date,bedtime:input.bedtime,wakeTime:input.wakeTime,bedOffset:bed.getTimezoneOffset(),wakeOffset:wake.getTimezoneOffset(),awakeMinutes:input.awakeMinutes};
 return duration(entry)?entry:null;
}
function guidance(group){
 const selected=groups.includes(group)?group:'unspecified';
 return {group:selected,minMinutes:selected==='teen'?480:420,maxMinutes:selected==='teen'?600:selected==='older'?480:540};
}
function create(storage,options={}){
 let state=empty();try{state=normalize(JSON.parse(storage.getItem(key)));}catch{}
 const copy=()=>JSON.parse(JSON.stringify(state));
 const today=()=>typeof options.today==='function'?options.today():dateKey(new Date());
 const persist=next=>{try{storage.setItem(key,JSON.stringify(next));state=next;return true;}catch{return false;}};
 const entries=()=>copy().entries.sort((a,b)=>b.date.localeCompare(a.date));
 const forDate=date=>{if(!validDate(date))return null;const entry=state.entries.find(item=>item.date===date);return entry?{...entry}:null;};
 function prepareEntry(input){
  const prior=state.entries.find(entry=>entry.date===input?.date);
  if(prior&&prior.bedtime===input.bedtime&&prior.wakeTime===input.wakeTime){const next={...prior,awakeMinutes:input.awakeMinutes};return duration(next)?next:null;}
  return prepare(input);
 }
 function save(input){
  const prepared=prepareEntry(input);if(!prepared||input.date>today()||!Number.isInteger(input.quality)||input.quality<1||input.quality>5||!Number.isInteger(input.fatigue)||input.fatigue<1||input.fatigue>5)return false;
  const next=copy(),prior=next.entries.find(entry=>entry.date===input.date);
  if(!prior&&next.entries.length>=5000)return false;
  const entry={...prepared,id:prior?.id||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,quality:input.quality,fatigue:input.fatigue};
  if(prior)next.entries[next.entries.indexOf(prior)]=entry;else next.entries.push(entry);
  return persist(next);
 }
 function remove(id){const next=copy();next.entries=next.entries.filter(entry=>entry.id!==id);return next.entries.length!==state.entries.length&&persist(next);}
 function restore(entry){
  if(!validEntry(entry)||state.entries.some(item=>item.id===entry.id||item.date===entry.date)||state.entries.length>=5000)return false;
  const next=copy();next.entries.push(cleanEntry(entry));return persist(next);
 }
 function setAgeGroup(group){if(!groups.includes(group))return false;const next=copy();next.ageGroup=group;return persist(next);}
 function week(endDate=today()){
  if(!validDate(endDate))return [];
  const result=[],end=new Date(endDate+'T12:00:00Z');
  for(let i=6;i>=0;i--){const date=new Date(end);date.setUTCDate(date.getUTCDate()-i);const day=date.toISOString().slice(0,10),entry=forDate(day);result.push({date:day,entry,...(entry?duration(entry):{inBedMinutes:null,sleepMinutes:null})});}
  return result;
 }
 function summary(endDate=today()){
  const logged=week(endDate).filter(day=>day.entry),count=logged.length,mean=field=>count?Math.round(logged.reduce((sum,day)=>sum+(field==='sleepMinutes'?day.sleepMinutes:day.entry[field]),0)/count*10)/10:null;
  return {count,averageMinutes:mean('sleepMinutes'),averageQuality:mean('quality'),averageFatigue:mean('fatigue')};
 }
 const preview=input=>{const entry=prepareEntry(input);return entry?duration(entry):null;};
 return Object.freeze({get:copy,entries,forDate,save,remove,restore,setAgeGroup,week,summary,preview,key});
}
root.FORME_RECOVERY=Object.freeze({create,key,groups,dateKey,validDate,validTime,duration,prepare,validEntry,validDocument,normalize,guidance});
})(typeof window!=='undefined'?window:globalThis);
