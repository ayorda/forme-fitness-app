/* Move existing FORME settings into a versioned document while mirroring old keys. */
(function(root){
'use strict';
const key='forme-user-v1';
const names=['favorites','plan','date-plans','completed-workouts','current-meal','saved-meals','sound','theme'];
const allowed=new Set(names);
const legacy=name=>'forme-'+name;
function create(storage){
 function parseCandidate(raw){if(typeof raw!=='string')return undefined;try{const v=JSON.parse(raw);return v===null||v===undefined?undefined:v;}catch{return undefined;}}
 let records={};try{const saved=JSON.parse(storage.getItem(key));if(saved?.version===1&&saved.records&&typeof saved.records==='object'&&!Array.isArray(saved.records))records={...saved.records};}catch{}
 let dirty=false;
 for(const k of Object.keys(records))if(!allowed.has(k)){delete records[k];dirty=true;}
 for(const name of names){
  const primary=parseCandidate(records[name]);
  if(primary!==undefined){
   try{if(storage.getItem(legacy(name))===null)storage.setItem(legacy(name),records[name]);}catch{}
   continue;
  }
  if(Object.prototype.hasOwnProperty.call(records,name)){delete records[name];dirty=true;}
  try{const value=storage.getItem(legacy(name));if(parseCandidate(value)!==undefined){records[name]=value;dirty=true;}}catch{}
 }
 if(dirty||!storage.getItem(key)){try{storage.setItem(key,JSON.stringify({version:1,records}));}catch{}}
 function load(name,fallback){
  if(!allowed.has(name))return fallback;
  const primary=parseCandidate(records[name]);
  if(primary!==undefined)return primary;
  try{
   const rawMirror=storage.getItem(legacy(name)),mirror=parseCandidate(rawMirror);
   if(mirror!==undefined){records={...records,[name]:rawMirror};try{storage.setItem(key,JSON.stringify({version:1,records}));}catch{}return mirror;}
  }catch{}
  return fallback;
 }
 function save(name,value){if(!allowed.has(name))return false;const raw=JSON.stringify(value),next={...records,[name]:raw};let priorEnvelope,priorLegacy;try{priorEnvelope=storage.getItem(key);priorLegacy=storage.getItem(legacy(name));storage.setItem(key,JSON.stringify({version:1,records:next}));storage.setItem(legacy(name),raw);records=next;return true;}catch{try{if(priorEnvelope===null)storage.removeItem(key);else if(priorEnvelope!==undefined)storage.setItem(key,priorEnvelope);if(priorLegacy===null)storage.removeItem(legacy(name));else if(priorLegacy!==undefined)storage.setItem(legacy(name),priorLegacy);}catch{}return false;}}
 return Object.freeze({load,save,key});
}
root.FORME_STORAGE_SCHEMA=Object.freeze({create,key,names});
})(typeof window!=='undefined'?window:globalThis);
