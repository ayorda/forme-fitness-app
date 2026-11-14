/* Explicit JSON export/import of FORME user data with a rollback on failed writes. */
(function(root){
'use strict';
const keys=['forme-favorites','forme-plan','forme-date-plans','forme-completed-workouts','forme-current-meal','forme-saved-meals','forme-sound','forme-theme','forme-music','forme-language','forme-user-v1','forme-progress-v1','forme-nutrition-v1','forme-recovery-v1'];
const recordNames=['favorites','plan','date-plans','completed-workouts','current-meal','saved-meals','sound','theme','music'];
function validObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(value+'T12:00:00');return !Number.isNaN(parsed.getTime())&&`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`===value;};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value)&&value.length<=60;
const grams=value=>{const normalized=String(value??'').trim().replace(',','.');const amount=Number(normalized);return /^\d+(?:\.\d+)?$/.test(normalized)&&Number.isFinite(amount)&&amount>0&&amount<=10000;};
const items=value=>Array.isArray(value)&&value.every(x=>validObject(x)&&id(x.id)&&grams(x.grams));
const journalItems=value=>items(value)&&value.length>0&&value.length<=100;
const uniqueIds=arr=>{const seen=new Set();return arr.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});};
const hasUniqueIds=arr=>new Set(arr.map(x=>x.id)).size===arr.length;
function validSetDetails(value){return (value.weightKg===undefined||(typeof value.weightKg==='number'&&Number.isFinite(value.weightKg)&&value.weightKg>=0&&value.weightKg<=500&&Math.abs(value.weightKg*100-Math.round(value.weightKg*100))<1e-6))&&(value.assistance===undefined||(typeof value.assistance==='string'&&value.assistance.length<=120));}
function cleanSetDetails(value){const out={};if(typeof value.weightKg==='number'&&Number.isFinite(value.weightKg)&&value.weightKg>0&&value.weightKg<=500&&Math.abs(value.weightKg*100-Math.round(value.weightKg*100))<1e-6)out.weightKg=value.weightKg;if(typeof value.assistance==='string'&&value.assistance.length<=120){const text=value.assistance.trim().replace(/\s+/g,' ');if(text)out.assistance=text;}return out;}
const setSignature=s=>`${s.date}|${s.exerciseId}|${s.kind}|${s.value}|${Number(s.weightKg)||0}|${String(s.assistance||'').trim().replace(/\s+/g,' ').toLocaleLowerCase()}`;
function recoveryMinutes(entry){
 if(!validObject(entry)||!date(entry.date)||typeof entry.bedtime!=='string'||typeof entry.wakeTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.bedtime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.wakeTime)||entry.bedtime===entry.wakeTime||![entry.bedOffset,entry.wakeOffset].every(x=>Number.isInteger(x)&&x>=-840&&x<=840)||!Number.isInteger(entry.awakeMinutes)||entry.awakeMinutes<0)return null;
 const clock=time=>Number(time.slice(0,2))*60+Number(time.slice(3)),bed=clock(entry.bedtime),wake=clock(entry.wakeTime),minutes=wake-bed+(bed>wake?1440:0)+entry.wakeOffset-entry.bedOffset;
 return minutes>0&&minutes<=1440&&entry.awakeMinutes<minutes?minutes-entry.awakeMinutes:null;
}
function validRecoveryEntry(entry){return validObject(entry)&&id(entry.id)&&recoveryMinutes(entry)!==null&&Number.isInteger(entry.quality)&&entry.quality>=1&&entry.quality<=5&&Number.isInteger(entry.fatigue)&&entry.fatigue>=1&&entry.fatigue<=5;}
function validRecovery(value){return validObject(value)&&value.version===1&&['unspecified','teen','adult','older'].includes(value.ageGroup)&&Array.isArray(value.entries)&&value.entries.length<=5000&&value.entries.every(validRecoveryEntry)&&hasUniqueIds(value.entries)&&new Set(value.entries.map(x=>x.date)).size===value.entries.length;}
function exportValue(key,value){
 if(typeof value!=='string')return null;
 if(validate({app:'FORME',version:1,data:{[key]:value}}))return value;
 try{
  const parsed=JSON.parse(value);
  if(key==='forme-theme'&&['dark','light','auto'].includes(parsed))return JSON.stringify(parsed);
  if(key==='forme-favorites'&&validObject(parsed)){
   const ex=Array.isArray(parsed.exercises)?parsed.exercises.filter(x=>typeof x==='string').slice(0,500):[];
   const wk=Array.isArray(parsed.workouts)?parsed.workouts.filter(x=>typeof x==='string').slice(0,500):[];
   const fd=Array.isArray(parsed.foods)?parsed.foods.filter(x=>typeof x==='string').slice(0,500):[];
   return JSON.stringify(fd.length?{exercises:ex,workouts:wk,foods:fd}:{exercises:ex,workouts:wk});
  }
  if((key==='forme-plan'||key==='forme-date-plans')&&validObject(parsed)){
   return JSON.stringify(Object.fromEntries(Object.entries(parsed).slice(0,2000).filter(([,v])=>typeof v==='string')));
  }
  if(key==='forme-completed-workouts'&&validObject(parsed)){
   return JSON.stringify(Object.fromEntries(Object.entries(parsed).slice(0,2000).filter(([d,v])=>date(d)&&validObject(v)&&id(v.id)&&typeof v.name==='string'&&v.name.trim()&&v.name.trim().length<=120).map(([d,v])=>[d,{id:v.id,name:v.name.trim()}])));
  }
  if(key==='forme-current-meal'&&Array.isArray(parsed)){
   return JSON.stringify(parsed.filter(x=>validObject(x)&&id(x.id)&&grams(x.grams)).slice(0,100).map(x=>({id:x.id,grams:String(x.grams)})));
  }
  if(key==='forme-saved-meals'&&Array.isArray(parsed)){
   const cleaned=parsed.slice(0,200).filter(x=>validObject(x)&&typeof x.name==='string'&&x.name.trim()&&x.name.trim().length<=70&&Array.isArray(x.items)).map(x=>({name:x.name.trim(),items:x.items.filter(i=>validObject(i)&&id(i.id)&&grams(i.grams)).map(i=>({id:i.id,grams:String(i.grams)}))})).filter(x=>journalItems(x.items));
   return JSON.stringify(cleaned);
  }
  if(key==='forme-progress-v1'&&parsed?.version===1&&validObject(parsed)){
   const g=validObject(parsed.goal)?parsed.goal:{};
   const goal={workoutsPerWeek:Number.isInteger(g.workoutsPerWeek)&&g.workoutsPerWeek>=1&&g.workoutsPerWeek<=7?g.workoutsPerWeek:3,minutesPerWeek:Number.isInteger(g.minutesPerWeek)&&g.minutesPerWeek>=0&&g.minutesPerWeek<=2000?g.minutesPerWeek:90};
   const sessions=Array.isArray(parsed.sessions)?uniqueIds(parsed.sessions.slice(0,5000).filter(x=>validObject(x)&&id(x.id)&&id(x.workoutId)&&date(x.date)&&typeof x.minutes==='number'&&Number.isFinite(x.minutes)&&x.minutes>=0&&x.minutes<=600).map(x=>({id:x.id,workoutId:x.workoutId,date:x.date,minutes:Math.round(x.minutes)}))):[];
   const sets=Array.isArray(parsed.sets)?uniqueIds(parsed.sets.slice(0,5000).filter(x=>validObject(x)&&id(x.id)&&id(x.exerciseId)&&date(x.date)&&['reps','seconds'].includes(x.kind)&&Number.isInteger(x.value)&&x.value>=1&&x.value<=3600).map(x=>({id:x.id,exerciseId:x.exerciseId,date:x.date,kind:x.kind,value:x.value,...cleanSetDetails(x)}))):[];
   return JSON.stringify({version:1,goal,sessions,sets});
  }
  if(key==='forme-nutrition-v1'&&parsed?.version===1&&validObject(parsed)){
   const g=validObject(parsed.goal)?parsed.goal:{};
   const goal={kcal:Number.isInteger(g.kcal)&&g.kcal>=1&&g.kcal<=10000?g.kcal:2000,protein:Number.isInteger(g.protein)&&g.protein>=0&&g.protein<=1000?g.protein:100};
   const entries=Array.isArray(parsed.entries)?uniqueIds(parsed.entries.slice(0,5000).filter(x=>validObject(x)&&id(x.id)&&date(x.date)&&Array.isArray(x.items)).map(x=>({id:x.id,date:x.date,name:typeof x.name==='string'?x.name.slice(0,70):'',items:x.items.filter(i=>validObject(i)&&id(i.id)&&grams(i.grams)).map(i=>({id:i.id,grams:String(i.grams)}))})).filter(x=>journalItems(x.items))):[];
   return JSON.stringify({version:1,goal,entries});
  }
  if(key==='forme-recovery-v1'&&parsed?.version===1&&validObject(parsed)){
   const dates=new Set(),clean=uniqueIds((Array.isArray(parsed.entries)?parsed.entries:[]).slice(0,5000).filter(validRecoveryEntry)).filter(entry=>{if(dates.has(entry.date))return false;dates.add(entry.date);return true;});
   return JSON.stringify({version:1,ageGroup:['unspecified','teen','adult','older'].includes(parsed.ageGroup)?parsed.ageGroup:'unspecified',entries:clean});
  }
  if(key==='forme-user-v1'&&parsed?.version===1&&validObject(parsed.records)){
   const records={};
   for(const [name,raw] of Object.entries(parsed.records)){
    if(!recordNames.includes(name))continue;
    const fixed=exportValue('forme-'+name,raw);
    if(fixed!==null)records[name]=fixed;
   }
   return JSON.stringify({version:1,records});
  }
 }catch{}
 return null;
}
function exportData(storage){const data={};for(const key of keys){const value=exportValue(key,storage.getItem(key));if(value!==null)data[key]=value;}return JSON.stringify({app:'FORME',version:1,exportedAt:new Date().toISOString(),data},null,2);}
function validate(payload){
 if(!validObject(payload)||payload.app!=='FORME'||payload.version!==1||!validObject(payload.data)||Object.keys(payload.data).some(k=>!keys.includes(k)))return false;
 for(const [key,value] of Object.entries(payload.data)){
  if(typeof value!=='string'||value.length>2_000_000)return false;
  if(key==='forme-language'){if(!['bg','en','de'].includes(value))return false;continue;}
  let parsed;try{parsed=JSON.parse(value);}catch{return false;}
  if(key==='forme-sound'){if(typeof parsed!=='boolean')return false;}
  else if(key==='forme-music'){if(!validObject(parsed)||typeof parsed.enabled!=='boolean'||!Number.isInteger(parsed.volume)||parsed.volume<0||parsed.volume>100||!['auto','calm','flow'].includes(parsed.mode))return false;}
  else if(key==='forme-recovery-v1'){if(!validRecovery(parsed))return false;}
  else if(key==='forme-theme'){if(!['dark','light','auto'].includes(parsed))return false;}
  else if(key==='forme-favorites'){if(!validObject(parsed)||!Array.isArray(parsed.exercises)||!Array.isArray(parsed.workouts)||(parsed.foods!==undefined&&!Array.isArray(parsed.foods))||parsed.exercises.length>500||parsed.workouts.length>500||(parsed.foods?.length||0)>500||![...parsed.exercises,...parsed.workouts,...(parsed.foods||[])].every(x=>typeof x==='string'))return false;}
  else if(key==='forme-plan'||key==='forme-date-plans'){if(!validObject(parsed)||Object.keys(parsed).length>2000||!Object.values(parsed).every(x=>typeof x==='string'))return false;}
  else if(key==='forme-completed-workouts'){if(!validObject(parsed)||Object.keys(parsed).length>2000||!Object.entries(parsed).every(([d,x])=>date(d)&&validObject(x)&&id(x.id)&&typeof x.name==='string'&&x.name.trim()!==''&&x.name.length<=120))return false;}
  else if(key==='forme-user-v1'){if(parsed?.version!==1||!validObject(parsed.records)||Object.entries(parsed.records).some(([name,raw])=>!recordNames.includes(name)||!validate({app:'FORME',version:1,data:{['forme-'+name]:raw}})))return false;}
  else if(key==='forme-current-meal'){if(!items(parsed)||parsed.length>100)return false;}
  else if(key==='forme-saved-meals'){if(!Array.isArray(parsed)||parsed.length>200||!parsed.every(x=>validObject(x)&&typeof x.name==='string'&&x.name.trim()!==''&&x.name.length<=70&&journalItems(x.items)))return false;}
  else if(key==='forme-progress-v1'){if(parsed?.version!==1||!Array.isArray(parsed.sessions)||!Array.isArray(parsed.sets)||parsed.sessions.length>5000||parsed.sets.length>5000||!Number.isInteger(parsed.goal?.workoutsPerWeek)||parsed.goal.workoutsPerWeek<1||parsed.goal.workoutsPerWeek>7||!Number.isInteger(parsed.goal?.minutesPerWeek)||parsed.goal.minutesPerWeek<0||parsed.goal.minutesPerWeek>2000||!parsed.sessions.every(x=>validObject(x)&&id(x.id)&&id(x.workoutId)&&date(x.date)&&Number.isFinite(x.minutes)&&x.minutes>=0&&x.minutes<=600)||!parsed.sets.every(x=>validObject(x)&&id(x.id)&&id(x.exerciseId)&&date(x.date)&&['reps','seconds'].includes(x.kind)&&Number.isInteger(x.value)&&x.value>=1&&x.value<=3600&&validSetDetails(x))||!hasUniqueIds(parsed.sessions)||!hasUniqueIds(parsed.sets))return false;}
  else if(key==='forme-nutrition-v1'){if(parsed?.version!==1||!Array.isArray(parsed.entries)||parsed.entries.length>5000||!Number.isInteger(parsed.goal?.kcal)||parsed.goal.kcal<1||parsed.goal.kcal>10000||!Number.isInteger(parsed.goal?.protein)||parsed.goal.protein<0||parsed.goal.protein>1000||!parsed.entries.every(x=>validObject(x)&&id(x.id)&&date(x.date)&&typeof x.name==='string'&&x.name.length<=70&&journalItems(x.items))||!hasUniqueIds(parsed.entries))return false;}
  else if(!validObject(parsed))return false;
 }
 return true;
}
function importData(storage,text){let parsed;try{parsed=JSON.parse(text);}catch{return false;}if(!validate(parsed))return false;
 const prior={};try{for(const key of keys)prior[key]=storage.getItem(key);for(const key of keys){if(Object.hasOwn(parsed.data,key))storage.setItem(key,parsed.data[key]);else storage.removeItem(key);}return true;}
 catch{for(const key of keys)try{if(prior[key]===null)storage.removeItem(key);else if(prior[key]!==undefined)storage.setItem(key,prior[key]);}catch{}return false;}
}
function mergeByIdAndSig(curList,incList,sigFn,limit){
 const out=[...curList],usedIds=new Set(out.map(x=>x.id)),usedSigs=new Set(out.map(sigFn));
 let seq=1;
 for(const item of incList){
  if(out.length>=limit)break;
  const sig=sigFn(item);
  if(usedSigs.has(sig))continue;
  let nextId=item.id;
  while(usedIds.has(nextId))nextId='m'+(seq++);
  usedIds.add(nextId);usedSigs.add(sig);
  out.push(nextId===item.id?item:{...item,id:nextId});
 }
 return out;
}
function mergeRecordValue(name,curRaw,incRaw){
 if(incRaw===null||incRaw===undefined)return curRaw;
 if(curRaw===null||curRaw===undefined)return incRaw;
 const cur=JSON.parse(curRaw),inc=JSON.parse(incRaw);
 if(name==='favorites'){
  const ex=[...new Set([...cur.exercises,...inc.exercises])].slice(0,500),wk=[...new Set([...cur.workouts,...inc.workouts])].slice(0,500),fd=[...new Set([...(cur.foods||[]),...(inc.foods||[])])].slice(0,500);
  return JSON.stringify(fd.length?{exercises:ex,workouts:wk,foods:fd}:{exercises:ex,workouts:wk});
 }
 if(name==='plan'||name==='date-plans'||name==='completed-workouts')return JSON.stringify(Object.fromEntries(Object.entries({...inc,...cur}).slice(0,2000)));
 if(name==='current-meal')return JSON.stringify(cur.length?[...cur,...inc.filter(x=>!cur.some(c=>c.id===x.id))].slice(0,100):inc);
 if(name==='saved-meals'){
  const sig=m=>m.name+'\0'+JSON.stringify(m.items),seen=new Set(cur.map(sig)),out=[...cur];
  for(const m of inc){if(out.length>=200)break;const s=sig(m);if(!seen.has(s)){seen.add(s);out.push(m);}}
  return JSON.stringify(out);
 }
 return curRaw;
}
function mergeData(storage,text){
 let parsed;try{parsed=JSON.parse(text);}catch{return false;}
 if(!validate(parsed))return false;
 const incUser=parsed.data['forme-user-v1']?JSON.parse(parsed.data['forme-user-v1']).records:{};
 const curUserRaw=exportValue('forme-user-v1',storage.getItem('forme-user-v1')),curUser=curUserRaw?JSON.parse(curUserRaw).records:{};
 const nextWrites={},mergedRecords={...curUser};
 for(const name of recordNames){
  const key='forme-'+name,incRaw=parsed.data[key]??incUser[name]??null;
  if(incRaw===null)continue;
  const curRaw=exportValue(key,storage.getItem(key))??curUser[name]??null;
  const merged=mergeRecordValue(name,curRaw,incRaw);
  if(merged!==null){nextWrites[key]=merged;mergedRecords[name]=merged;}
 }
 if(curUserRaw!==null||Object.hasOwn(parsed.data,'forme-user-v1'))nextWrites['forme-user-v1']=JSON.stringify({version:1,records:mergedRecords});
 if(Object.hasOwn(parsed.data,'forme-progress-v1')){
  const curProgRaw=exportValue('forme-progress-v1',storage.getItem('forme-progress-v1'));
  if(!curProgRaw)nextWrites['forme-progress-v1']=parsed.data['forme-progress-v1'];
  else{
   const curProg=JSON.parse(curProgRaw),incProg=JSON.parse(parsed.data['forme-progress-v1']);
   const sessions=mergeByIdAndSig(curProg.sessions,incProg.sessions,s=>`${s.date}|${s.workoutId}|${s.minutes}`,5000);
   const sets=mergeByIdAndSig(curProg.sets,incProg.sets,setSignature,5000);
   nextWrites['forme-progress-v1']=JSON.stringify({version:1,goal:curProg.goal,sessions,sets});
  }
 }
 if(Object.hasOwn(parsed.data,'forme-nutrition-v1')){
  const curNutrRaw=exportValue('forme-nutrition-v1',storage.getItem('forme-nutrition-v1'));
  if(!curNutrRaw)nextWrites['forme-nutrition-v1']=parsed.data['forme-nutrition-v1'];
  else{
   const curNutr=JSON.parse(curNutrRaw),incNutr=JSON.parse(parsed.data['forme-nutrition-v1']);
   const entries=mergeByIdAndSig(curNutr.entries,incNutr.entries,e=>`${e.date}|${e.name}|${JSON.stringify(e.items)}`,5000);
   nextWrites['forme-nutrition-v1']=JSON.stringify({version:1,goal:curNutr.goal,entries});
  }
 }
 if(Object.hasOwn(parsed.data,'forme-recovery-v1')){
  const currentRaw=exportValue('forme-recovery-v1',storage.getItem('forme-recovery-v1')),incoming=JSON.parse(parsed.data['forme-recovery-v1']);
  if(!currentRaw)nextWrites['forme-recovery-v1']=parsed.data['forme-recovery-v1'];
  else {const current=JSON.parse(currentRaw),merged=mergeByIdAndSig(current.entries,incoming.entries,entry=>entry.date,5000);nextWrites['forme-recovery-v1']=JSON.stringify({version:1,ageGroup:current.ageGroup,entries:merged});}
 }
 if(Object.hasOwn(parsed.data,'forme-language')&&!storage.getItem('forme-language'))nextWrites['forme-language']=parsed.data['forme-language'];
 const writeKeys=Object.keys(nextWrites),prior={};
 try{for(const k of writeKeys)prior[k]=storage.getItem(k);for(const k of writeKeys)storage.setItem(k,nextWrites[k]);return true;}
 catch{for(const k of writeKeys)try{if(prior[k]===null)storage.removeItem(k);else if(prior[k]!==undefined)storage.setItem(k,prior[k]);}catch{}return false;}
}
function clearData(storage){
 const dataKeys=keys.filter(k=>k!=='forme-language'),prior={};
 try{for(const k of dataKeys)prior[k]=storage.getItem(k);for(const k of dataKeys)storage.removeItem(k);return true;}
 catch{for(const k of dataKeys)try{if(prior[k]!==null&&prior[k]!==undefined)storage.setItem(k,prior[k]);}catch{}return false;}
}
function summarizeArchive(text){
 let parsed;try{parsed=JSON.parse(text);}catch{return null;}
 if(!validate(parsed))return null;
 const d=parsed.data||{},u=d['forme-user-v1']?JSON.parse(d['forme-user-v1']).records||{}:{};
 const prog=d['forme-progress-v1']?JSON.parse(d['forme-progress-v1']):null;
 const nutr=d['forme-nutrition-v1']?JSON.parse(d['forme-nutrition-v1']):null;
 const savedRaw=d['forme-saved-meals']??u['saved-meals']??null,saved=savedRaw?JSON.parse(savedRaw):[];
 const favRaw=d['forme-favorites']??u['favorites']??null,fav=favRaw?JSON.parse(favRaw):{exercises:[],workouts:[]};
 return {
  ...(d['forme-recovery-v1']?{recoveryEntries:JSON.parse(d['forme-recovery-v1']).entries.length}:{}),
  exportedAt:typeof parsed.exportedAt==='string'?parsed.exportedAt:null,
  sessions:prog?prog.sessions.length:0,
  sets:prog?prog.sets.length:0,
  nutritionEntries:nutr?nutr.entries.length:0,
  savedMeals:Array.isArray(saved)?saved.length:0,
  favorites:(fav.exercises?.length||0)+(fav.workouts?.length||0)+(fav.foods?.length||0)
 };
}
root.FORME_BACKUP=Object.freeze({keys,exportData,importData,mergeData,clearData,summarizeArchive,validate});
})(typeof window!=='undefined'?window:globalThis);
