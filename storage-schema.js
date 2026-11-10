/* Move existing FORME settings into a versioned document while mirroring old keys. */
(function(root){
'use strict';
const key='forme-user-v1';
const names=['favorites','plan','date-plans','completed-workouts','current-meal','saved-meals','sound'];
const allowed=new Set(names);
const legacy=name=>'forme-'+name;
function create(storage){
 let records={};try{const saved=JSON.parse(storage.getItem(key));if(saved?.version===1&&saved.records&&typeof saved.records==='object'&&!Array.isArray(saved.records))records={...saved.records};}catch{}
 let migrated=false;
 for(const name of names){
  if(typeof records[name]==='string')continue;
  try{const value=storage.getItem(legacy(name));if(typeof value==='string'){records[name]=value;migrated=true;}}catch{}
 }
 if(migrated||!storage.getItem(key)){try{storage.setItem(key,JSON.stringify({version:1,records}));}catch{}}
 function parseCandidate(raw){if(typeof raw!=='string')return undefined;try{const v=JSON.parse(raw);return v===null||v===undefined?undefined:v;}catch{return undefined;}}
 function load(name,fallback){
  if(!allowed.has(name))return fallback;
  const primary=parseCandidate(records[name]);
  if(primary!==undefined)return primary;
  try{const mirror=parseCandidate(storage.getItem(legacy(name)));if(mirror!==undefined)return mirror;}catch{}
  return fallback;
 }
 function save(name,value){if(!allowed.has(name))return false;const raw=JSON.stringify(value),next={...records,[name]:raw};let priorEnvelope,priorLegacy;try{priorEnvelope=storage.getItem(key);priorLegacy=storage.getItem(legacy(name));storage.setItem(key,JSON.stringify({version:1,records:next}));storage.setItem(legacy(name),raw);records=next;return true;}catch{try{if(priorEnvelope===null)storage.removeItem(key);else if(priorEnvelope!==undefined)storage.setItem(key,priorEnvelope);if(priorLegacy===null)storage.removeItem(legacy(name));else if(priorLegacy!==undefined)storage.setItem(legacy(name),priorLegacy);}catch{}return false;}}
 return Object.freeze({load,save,key});
}
root.FORME_STORAGE_SCHEMA=Object.freeze({create,key,names});
})(typeof window!=='undefined'?window:globalThis);
