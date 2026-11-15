/* Deterministic per-record merge. No clock-based expiry or cloud permissions. */
(function(root){
'use strict';
const MAX_RECORDS=50000,MAX_COUNTER=9007199254740000;
const KEYS=Object.freeze(['forme-favorites','forme-plan','forme-date-plans','forme-completed-workouts','forme-saved-meals','forme-progress-v1','forme-nutrition-v1','forme-recovery-v1','forme-personal-v1']);
const map=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>map(value)&&Object.keys(value).sort().join(',')===keys.split(',').sort().join(',');
const stable=value=>JSON.stringify(value,(_,item)=>map(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a<b?-1:a>b?1:0)):item);
const same=(a,b)=>stable(a)===stable(b);
const invalid=()=>{throw Error('invalid');};
const actor=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
const short=value=>typeof value==='string'&&value.length>0&&value.length<=300;
const recordId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,60}$/.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
function validKey(key){
 if(typeof key!=='string'||key.length>512)return false;
 let parts;try{parts=JSON.parse(key);}catch{return false;}
 if(!Array.isArray(parts)||stable(parts)!==key)return false;
 const [kind,id,member]=parts;
 if(kind==='favorite')return parts.length===3&&['exercises','workouts','foods'].includes(id)&&short(member);
 if(parts.length!==2)return false;
 if(kind==='plan')return ['mon','tue','wed','thu','fri','sat','sun'].includes(id);
 if(['datePlan','completed','sleep'].includes(kind))return date(id);
 if(kind==='meal')return typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
 if(['session','set','nutrition'].includes(kind))return recordId(id);
 if(kind==='setting')return ['progressGoal','nutritionGoal','ageGroup','profile'].includes(id);
 return kind==='recipe'&&['oat-bowl','lentil-bowl','tuna-toast'].includes(id);
}
async function hash(value){const bytes=new TextEncoder().encode(stable(value));return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
async function flatten(archive){
 if(!root.FORME_BACKUP.validate(archive))invalid();
 const flat=Object.create(null),add=(key,value)=>{const name=stable(key);if(!validKey(name))invalid();flat[name]=value;};
 for(const key of KEYS){
  if(!Object.hasOwn(archive.data,key))continue;const value=JSON.parse(archive.data[key]);
  if(key==='forme-favorites'){for(const kind of ['exercises','workouts','foods'])for(const id of value[kind]||[])add(['favorite',kind,id],true);}
  else if(key==='forme-plan'||key==='forme-date-plans'||key==='forme-completed-workouts'){const kind={'forme-plan':'plan','forme-date-plans':'datePlan','forme-completed-workouts':'completed'}[key];for(const [id,item] of Object.entries(value))add([kind,id],item);}
  else if(key==='forme-saved-meals'){for(const meal of value)add(['meal',await hash(meal)],meal);}
  else if(key==='forme-progress-v1'){add(['setting','progressGoal'],value.goal);for(const item of value.sessions)add(['session',item.id],item);for(const item of value.sets)add(['set',item.id],item);}
  else if(key==='forme-nutrition-v1'){add(['setting','nutritionGoal'],value.goal);for(const item of value.entries)add(['nutrition',item.id],item);}
  else if(key==='forme-recovery-v1'){add(['setting','ageGroup'],value.ageGroup);for(const item of value.entries)add(['sleep',item.date],item);}
  else if(key==='forme-personal-v1'){if(value.profile!==null)add(['setting','profile'],value.profile);for(const [id,item] of Object.entries(value.selection||{}))add(['recipe',id],item);}
 }
 if(Object.keys(flat).length>MAX_RECORDS)invalid();return flat;
}
function valid(state){
 return exact(state,'app,version,enabled,records')&&state.app==='FORME_SYNC'&&state.version===1&&state.enabled===true&&map(state.records)&&Object.keys(state.records).length<=MAX_RECORDS&&Object.entries(state.records).every(([key,value])=>validKey(key)&&exact(value,'c,a,v')&&Number.isSafeInteger(value.c)&&value.c>0&&value.c<=MAX_COUNTER&&actor(value.a)&&value.v!==undefined);
}
function join(left,right){
 const records=Object.create(null);
 for(const source of [left,right])for(const [key,next] of Object.entries(source)){
  const current=records[key];if(!current||next.c>current.c||next.c===current.c&&(next.a>current.a||next.a===current.a&&stable(next.v)>stable(current.v)))records[key]=next;
 }
 if(Object.keys(records).length>MAX_RECORDS)invalid();return records;
}
function changes(records,baseline,current,device){
 if(!actor(device))invalid();let clock=Object.values(records).reduce((max,item)=>Math.max(max,item.c),0);const result={...records};
 for(const key of new Set([...Object.keys(baseline),...Object.keys(current)]))if(!same(baseline[key],current[key])){
  if(!validKey(key)||clock>=MAX_COUNTER)invalid();result[key]={c:++clock,a:device,v:Object.hasOwn(current,key)?current[key]:null};
 }
 if(Object.keys(result).length>MAX_RECORDS)invalid();return result;
}
function materialize(records,base={app:'FORME',version:1,data:{}}){
 if(!root.FORME_BACKUP.validate(base))invalid();
 const values=Object.create(null);for(const [key,item] of Object.entries(records))if(item.v!==null){if(!validKey(key))invalid();values[key]=item.v;}
 const data=Object.fromEntries(Object.entries(base.data).filter(([key])=>!KEYS.includes(key))),favorites={exercises:[],workouts:[],foods:[]},plan={},datePlans={},completed={},meals=[],sessions=[],sets=[],nutrition=[],sleep=[],settings={},selection={};
 for(const [key,value] of Object.entries(values).sort(([a],[b])=>a<b?-1:a>b?1:0)){
  const [kind,id,member]=JSON.parse(key);
  if(kind==='favorite'){if(value!==true)invalid();favorites[id].push(member);}
  else if(kind==='plan')plan[id]=value;
  else if(kind==='datePlan')datePlans[id]=value;
  else if(kind==='completed')completed[id]=value;
  else if(kind==='meal')meals.push(value);
  else if(kind==='session'){if(value?.id!==id)invalid();sessions.push(value);}
  else if(kind==='set'){if(value?.id!==id)invalid();sets.push(value);}
  else if(kind==='nutrition'){if(value?.id!==id)invalid();nutrition.push(value);}
  else if(kind==='sleep'){if(value?.date!==id)invalid();sleep.push(value);}
  else if(kind==='setting')settings[id]=value;
  else if(kind==='recipe')selection[id]=value;
 }
 const put=(key,value)=>{data[key]=JSON.stringify(value);};
 put('forme-favorites',favorites);put('forme-plan',plan);put('forme-date-plans',datePlans);put('forme-completed-workouts',completed);put('forme-saved-meals',meals);
 if(sessions.length||sets.length||settings.progressGoal)put('forme-progress-v1',{version:1,goal:settings.progressGoal||{workoutsPerWeek:3,minutesPerWeek:90},sessions,sets});
 if(nutrition.length||settings.nutritionGoal)put('forme-nutrition-v1',{version:1,goal:settings.nutritionGoal||{kcal:2000,protein:100},entries:nutrition});
 if(sleep.length||settings.ageGroup)put('forme-recovery-v1',{version:1,ageGroup:settings.ageGroup||'unspecified',entries:sleep});
 put('forme-personal-v1',{version:1,profile:settings.profile||null,selection});
 // The envelope mirrors legacy keys and must never revive an old deleted item.
 const names=root.FORME_STORAGE_SCHEMA?.names||['favorites','plan','date-plans','completed-workouts','current-meal','saved-meals','sound','theme','music'];
 put('forme-user-v1',{version:1,records:Object.fromEntries(names.filter(name=>Object.hasOwn(data,'forme-'+name)).map(name=>[name,data['forme-'+name]]))});
 const archive={app:'FORME',version:1,data};if(!root.FORME_BACKUP.validate(archive))invalid();return archive;
}
async function validateState(state){if(!valid(state))invalid();const flat=await flatten(materialize(state.records));for(const [key,item] of Object.entries(state.records))if(item.v!==null&&!same(flat[key],item.v))invalid();return state;}
root.FORME_SYNC_RECORDS=Object.freeze({KEYS,MAX_RECORDS,MAX_COUNTER,stable,same,actor,validKey,flatten,valid,validateState,join,changes,materialize});
})(typeof window!=='undefined'?window:globalThis);
