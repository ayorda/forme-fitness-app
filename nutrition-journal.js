/* Local, versioned nutrition records. Food IDs and preparation states come from the catalog. */
(function(root){
'use strict';
const key='forme-nutrition-v1';
const empty=()=>({version:1,goal:{kcal:2000,protein:100},entries:[]});
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&dateKey(new Date(value+'T12:00:00'))===value;
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value)&&value.length<=60;
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function create(storage,foods,core){
 const validItems=items=>Array.isArray(items)&&items.length>0&&items.length<=100&&items.every(item=>plain(item)&&foods.some(f=>f.id===item.id)&&core.validateGrams(item.grams).ok);
 let state=empty();
 try{
  const saved=JSON.parse(storage.getItem(key));
  if(plain(saved)&&saved.version===1){
   const g=plain(saved.goal)?saved.goal:{},seen=new Set(),entries=[];
   if(Array.isArray(saved.entries)){
    for(const x of saved.entries){
     if(!plain(x)||!validId(x.id)||seen.has(x.id)||!validDate(x.date)||!validItems(x.items))continue;
     seen.add(x.id);
     entries.push({id:x.id,date:x.date,name:typeof x.name==='string'?x.name.slice(0,70):'',items:x.items.map(i=>({id:i.id,grams:String(i.grams)}))});
    }
   }
   state={
    version:1,
    goal:{
     kcal:Number.isInteger(g.kcal)&&g.kcal>=1&&g.kcal<=10000?g.kcal:2000,
     protein:Number.isInteger(g.protein)&&g.protein>=0&&g.protein<=1000?g.protein:100
    },
    entries
   };
  }
 }catch{}
 const copy=()=>JSON.parse(JSON.stringify(state));
 const persist=next=>{try{storage.setItem(key,JSON.stringify(next));state=next;return true;}catch{return false;}};
 const total=items=>core.sumMeal(items,foods);
 function add(date,items,name=''){
  if(!validDate(date)||!validItems(items)||typeof name!=='string'||name.length>70)return false;
  const next=copy();next.entries.push({id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,date,name,items:items.map(x=>({id:x.id,grams:String(x.grams)}))});return persist(next);
 }
 function update(id,date,items,name=''){
  if(!validDate(date)||!validItems(items)||typeof name!=='string'||name.length>70)return false;
  const next=copy(),entry=next.entries.find(x=>x.id===id);if(!entry)return false;
  Object.assign(entry,{date,name,items:items.map(x=>({id:x.id,grams:String(x.grams)}))});return persist(next);
 }
 function remove(id){const next=copy();next.entries=next.entries.filter(x=>x.id!==id);return next.entries.length!==state.entries.length&&persist(next);}
 function setGoal(kcal,protein){if(!Number.isInteger(kcal)||kcal<1||kcal>10000||!Number.isInteger(protein)||protein<0||protein>1000)return false;const next=copy();next.goal={kcal,protein};return persist(next);}
 /* A date selector can be cleared by the user; an empty value must never mean "every date". */
 function entries(date){const matches=state.entries.filter(x=>(date===undefined||(validDate(date)&&x.date===date))&&validItems(x.items));return matches.sort((a,b)=>b.date.localeCompare(a.date));}
 function day(date){const matches=entries(date),sum=matches.reduce((acc,x)=>{const value=total(x.items);for(const field of ['kcal','protein','carbs','fat','fiber'])acc[field]+=value[field];return acc;},{kcal:0,protein:0,carbs:0,fat:0,fiber:0});return {...sum,count:matches.length,date:validDate(date)?date:null,validDate:validDate(date),goal:{...state.goal}};}
 function week(endDate){const last=validDate(endDate)?endDate:dateKey(new Date());const days=[];for(let offset=6;offset>=0;offset--){const date=new Date(last+'T12:00:00');date.setDate(date.getDate()-offset);const key=dateKey(date),d=day(key);days.push({date:key,kcal:d.kcal,protein:d.protein});}return days;}
 return Object.freeze({get:copy,entries,day,week,add,update,remove,setGoal,total,key});
}
root.FORME_NUTRITION_JOURNAL=Object.freeze({create,key,dateKey});
})(typeof window!=='undefined'?window:globalThis);
