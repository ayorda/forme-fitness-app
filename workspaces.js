/* Local account workspaces. Firebase SDK storage stays outside this facade. */
(function(root){
'use strict';
const META='forme-workspaces-v1',PREFIX='forme-workspace-v1:',BARRIER='local-clear-v1',DEVICE=new Set(['forme-language','forme-theme','forme-sound','forme-music']);
function open(raw,uid,backup){
 if(uid!==null&&(typeof uid!=='string'||!uid||uid.length>128||uid.includes('/')))throw Error('workspace');
 const prefix=uid?PREFIX+uid+':':'',names=new Set(backup.keys),listeners=new Set(),seen=new Map();let active=true;
 const barrier=uid?raw.getItem(prefix+BARRIER):null;
 if(barrier!==null){let status;try{status=JSON.parse(barrier);}catch{throw Error('workspace-clearing');}if(status?.version!==1||status.state!=='cleared'||typeof status.nonce!=='string')throw Error('workspace-clearing');}
 const physical=key=>prefix&&names.has(key)&&!DEVICE.has(key)?prefix+key:key;
 // One legacy binding per browser. Original guest keys stay intact.
 if(uid&&raw.getItem(META)===null&&barrier===null){
  const before=new Map();try{
   for(const key of backup.keys)if(!DEVICE.has(key)){const target=physical(key);before.set(target,raw.getItem(target));const value=raw.getItem(key);if(value!==null&&before.get(target)===null)raw.setItem(target,value);}
   raw.setItem(META,JSON.stringify({version:1,migrated:true}));
  }catch(error){for(const [key,value] of before)try{if(value===null)raw.removeItem(key);else raw.setItem(key,value);}catch{}throw error;}
 }
 if(uid&&raw.getItem(META)===null&&barrier!==null)raw.setItem(META,JSON.stringify({version:1,migrated:true}));
 // The original migration only needs a completed marker, not the old UID.
 try{const meta=JSON.parse(raw.getItem(META));if(meta?.version===1&&typeof meta.legacyUid==='string'&&Object.keys(meta).sort().join(',')==='legacyUid,version')raw.setItem(META,JSON.stringify({version:1,migrated:true}));}catch{}
 function view(key,value){if(key!=='forme-user-v1'||value===null)return value;try{const document=JSON.parse(value);if(document?.version!==1||!document.records||typeof document.records!=='object'||Array.isArray(document.records))return value;for(const name of ['theme','sound','music']){const current=raw.getItem('forme-'+name);if(current===null)delete document.records[name];else document.records[name]=current;}return JSON.stringify(document);}catch{return value;}}
 const isActive=()=>{try{return active&&(!uid||raw.getItem(prefix+BARRIER)===barrier);}catch{return false;}};
 const assert=()=>{if(!isActive())throw Error('workspace-changed');};
 const notify=key=>{for(const listener of listeners)try{listener(key);}catch{}};
 const storage=Object.freeze({
  getItem(key){assert();const value=raw.getItem(physical(key));seen.set(key,value);return view(key,value);},
  setItem(key,value){assert();const target=physical(key),next=String(value);const current=raw.getItem(target);if(current===next){seen.set(key,next);return;}if(names.has(key)&&seen.has(key)&&seen.get(key)!==current)throw Error('workspace-conflict');raw.setItem(target,next);seen.set(key,next);notify(key);},
  removeItem(key){assert();const target=physical(key);const current=raw.getItem(target);if(current===null){seen.set(key,null);return;}if(names.has(key)&&seen.has(key)&&seen.get(key)!==current)throw Error('workspace-conflict');raw.removeItem(target);seen.set(key,null);notify(key);}
 });
 const transfer=Object.freeze({getItem(key){assert();return view(key,raw.getItem(physical(key)));},setItem(key,value){assert();raw.setItem(physical(key),String(value));notify(key);},removeItem(key){assert();raw.removeItem(physical(key));notify(key);}});
 return Object.freeze({uid,storage,transfer,prefix,physical,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},revoke(){active=false;},active:isActive,
  external(event){if(!isActive())return false;for(const key of backup.keys)if(event.key===physical(key)){notify(key);return true;}return false;},
  getMeta(key){assert();return raw.getItem(prefix+key);},setMeta(key,value){assert();raw.setItem(prefix+key,String(value));}
 });
}
root.FORME_WORKSPACES=Object.freeze({open,META,PREFIX,BARRIER,DEVICE:Object.freeze([...DEVICE])});
})(typeof window!=='undefined'?window:globalThis);
