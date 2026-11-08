/* Local, versioned nutrition records. Food IDs and preparation states come from the catalog. */
(function(root){
'use strict';
const key='forme-nutrition-v1';
const empty=()=>({version:1,goal:{kcal:2000,protein:100},entries:[]});
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&dateKey(new Date(value+'T12:00:00'))===value;
function create(storage,foods,core){
 let state=empty();try{const saved=JSON.parse(storage.getItem(key));if(saved?.version===1&&Array.isArray(saved.entries)&&Number.isInteger(saved.goal?.kcal)&&Number.isInteger(saved.goal?.protein)){saved.entries=saved.entries.filter(x=>x&&typeof x.id==='string'&&validDate(x.date)&&Array.isArray(x.items));state=saved;}}catch{}
 const copy=()=>JSON.parse(JSON.stringify(state));
 const persist=next=>{try{storage.setItem(key,JSON.stringify(next));state=next;return true;}catch{return false;}};
 const validItems=items=>Array.isArray(items)&&items.length>0&&items.length<=100&&items.every(item=>foods.some(f=>f.id===item.id)&&core.validateGrams(item.grams).ok);
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
 function entries(date){return state.entries.filter(x=>(!date||x.date===date)&&validItems(x.items)).sort((a,b)=>b.date.localeCompare(a.date));}
 function day(date){const matches=entries(date),sum=matches.reduce((acc,x)=>{const value=total(x.items);for(const field of ['kcal','protein','carbs','fat','fiber'])acc[field]+=value[field];return acc;},{kcal:0,protein:0,carbs:0,fat:0,fiber:0});return {...sum,count:matches.length,goal:{...state.goal}};}
 return Object.freeze({get:copy,entries,day,add,update,remove,setGoal,total,key});
}
root.FORME_NUTRITION_JOURNAL=Object.freeze({create,key,dateKey});
})(typeof window!=='undefined'?window:globalThis);
