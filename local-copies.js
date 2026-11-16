/* Explicit export/cleanup of inactive local account copies. No cloud/Auth API. */
(function(root){
'use strict';
const MAX_KEYS=10000,MAX_BYTES=16*1024*1024;
const fail=code=>{const error=Error(code);error.localCode=code;return error;};
const stable=value=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)));
const bytes=value=>new TextEncoder().encode(value).byteLength;
function create(raw,backup,options={}){
 const W=root.FORME_WORKSPACES,AUTO='forme-auto-v1',keys=backup.keys.filter(key=>!W.DEVICE.includes(key)),slots=[...keys,AUTO],tokens=new Map();let next=0,permit=null;
 const context=options.context||(()=>({uid:null,authUid:null,active:true}));
 const lock=options.withLock||(root.navigator?.locks?((name,fn)=>root.navigator.locks.request(name,{mode:'exclusive'},fn)):null);
 const uidValid=uid=>typeof uid==='string'&&uid.length>0&&uid.length<=128&&!uid.includes('/');
 function current(){const value=context();if(!value?.active)throw fail('changed');return {uid:value.uid||null,authUid:value.authUid||null};}
 const sameContext=value=>stable(current())===value;
 function allowed(uid){const value=current();if(!uidValid(uid)||uid===value.uid||uid===value.authUid)throw fail('active');}
 const prefix=uid=>W.PREFIX+uid+':';
 const read=uid=>Object.fromEntries(slots.map(key=>[key,raw.getItem(prefix(uid)+key)]));
 const restoreValue=(key,value)=>{if(value===null)raw.removeItem(key);else raw.setItem(key,value);};
 const digest=async value=>{if(!root.crypto?.subtle)throw fail('unsupported');return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');};
 function barrier(uid){const value=raw.getItem(prefix(uid)+W.BARRIER);if(value===null)return null;try{return JSON.parse(value);}catch{return {state:'clearing'};}}
 function emptyPlaceholder(value){try{const item=JSON.parse(value);return item?.version===1&&item.enabled===false&&item.paused===true&&item.lastSync===null&&typeof item.actor==='string'&&/^[a-f0-9]{32}$/.test(item.actor)&&Object.keys(item).sort().join(',')==='actor,base,enabled,lastSync,paused,records,version'&&item.records&&Object.keys(item.records).length===0&&item.base&&Object.keys(item.base).length===0;}catch{return false;}}
 const errorCode=error=>error?.localCode||'storage';
 function inspect(uid){
  allowed(uid);const values=read(uid),marker=barrier(uid),interrupted=marker!==null&&marker.state!=='cleared',hasData=keys.some(key=>values[key]!==null),hasCache=values[AUTO]!==null;
  if(!hasData&&(!hasCache||emptyPlaceholder(values[AUTO]))&&!interrupted)return null;
  if(!tokens.has(uid))tokens.set(uid,'copy-'+(++next));
  const size=Object.values(values).reduce((total,value)=>total+(value===null?0:bytes(value)),0);
  const summary=backup.summarizeArchive(backup.exportData({getItem:key=>Object.hasOwn(values,key)?values[key]:null}));
  let lastSync=null;try{const value=JSON.parse(values[AUTO])?.lastSync;if(Number.isFinite(value)&&value>=0&&value<=4102444800000)lastSync=value;}catch{}
  return {uid,id:tokens.get(uid),number:Number(tokens.get(uid).slice(5)),bytes:size,hasCache,interrupted,summary,lastSync};
 }
 function list(){
  try{
   current();const count=raw.length;if(!Number.isSafeInteger(count)||count<0||count>MAX_KEYS)throw fail('large');const found=new Set();
   for(let i=0;i<count;i++){
    const physical=raw.key(i);if(typeof physical!=='string'||!physical.startsWith(W.PREFIX))continue;
    for(const logical of [...slots,W.BARRIER])if(physical.endsWith(':'+logical)){const uid=physical.slice(W.PREFIX.length,-logical.length-1);if(uidValid(uid))found.add(uid);break;}
   }
   const profiles=[];for(const uid of [...found].sort()){const active=current();if(uid===active.uid||uid===active.authUid)continue;const item=inspect(uid);if(item){const {uid:privateUid,...publicItem}=item;profiles.push(publicItem);}}
   return {ok:true,profiles};
  }catch(error){return {ok:false,code:errorCode(error),profiles:[]};}
 }
 function target(id){const uid=[...tokens].find(([,value])=>value===id)?.[0];if(!uid)throw fail('missing');allowed(uid);if(!inspect(uid))throw fail('missing');return uid;}
 const get=()=>({prepared:!!permit,number:permit?.number||null});
 return Object.freeze({list,get,cancel(){permit=null;},
  async prepare(id){
   permit=null;
   try{
    const stamp=stable(current()),uid=target(id),source=read(uid),encoded=stable(source),marker=raw.getItem(prefix(uid)+W.BARRIER),fingerprint=await digest(encoded);
    if(!sameContext(stamp))throw fail('changed');allowed(uid);
    if(stable(read(uid))!==encoded||raw.getItem(prefix(uid)+W.BARRIER)!==marker)throw fail('changed');
    const device=Object.fromEntries(W.DEVICE.map(key=>[key,raw.getItem(key)]));
    const archive=JSON.parse(backup.exportData({getItem:key=>Object.hasOwn(source,key)?source[key]:device[key]??null}));
    // Standard data remains importable; raw recovery preserves invalid values and
    // queued metadata without ever restoring tokens, cache or consent on import.
    archive.localCopy={version:1,kind:'inactive-account',rawData:Object.fromEntries(Object.entries(source).filter(([,value])=>value!==null))};
    const text=JSON.stringify(archive,null,2);if(bytes(text)>MAX_BYTES)throw fail('large');
    const number=Number(id.slice(5));permit={uid,number,stamp,fingerprint,encoded,marker};return {ok:true,text,number};
   }catch(error){return {ok:false,code:errorCode(error)};}
  },
  async remove(consent){
   if(consent!==true)return {ok:false,code:'consent'};if(!permit)return {ok:false,code:'backup'};const plan=permit;
   try{
    if(!lock)throw fail('unsupported');
    return await lock('forme-auto:'+plan.uid,async()=>{
     if(permit!==plan||!sameContext(plan.stamp))throw fail('changed');allowed(plan.uid);
     const source=read(plan.uid),encoded=stable(source),fingerprint=await digest(encoded);
     if(permit!==plan||!sameContext(plan.stamp)||fingerprint!==plan.fingerprint||encoded!==plan.encoded||stable(read(plan.uid))!==encoded||raw.getItem(prefix(plan.uid)+W.BARRIER)!==plan.marker)throw fail('changed');allowed(plan.uid);
     const random=new Uint8Array(16);root.crypto.getRandomValues(random);const nonce=Array.from(random,x=>x.toString(16).padStart(2,'0')).join(''),guard=prefix(plan.uid)+W.BARRIER;
     const paused=JSON.stringify({version:1,actor:nonce,enabled:false,paused:true,records:{},base:{},lastSync:null});
     let guarded=false;
     try{
      raw.setItem(guard,JSON.stringify({version:1,state:'clearing',nonce}));guarded=true;
      // v0.12 clients understand this paused empty state and cannot interpret
      // erased local records as deletions to be sent to the cloud.
      raw.setItem(prefix(plan.uid)+AUTO,paused);
      for(const key of keys)if(source[key]!==null)raw.removeItem(prefix(plan.uid)+key);
      if(keys.some(key=>raw.getItem(prefix(plan.uid)+key)!==null)||raw.getItem(prefix(plan.uid)+AUTO)!==paused)throw fail('changed');
      raw.setItem(guard,JSON.stringify({version:1,state:'cleared',nonce}));permit=null;return {ok:true,code:'removed'};
     }catch(error){
      let restored=true;
      if(guarded){
       for(const key of keys)try{restoreValue(prefix(plan.uid)+key,source[key]);}catch{restored=false;}
       if(restored){try{restoreValue(prefix(plan.uid)+AUTO,source[AUTO]);restoreValue(guard,plan.marker);}catch{restored=false;}}
       if(!restored){try{raw.setItem(prefix(plan.uid)+AUTO,paused);}catch{}}
      }
      permit=null;return {ok:false,code:restored?'storage':'partial'};
     }
    });
   }catch(error){permit=null;return {ok:false,code:errorCode(error)};}
  }
 });
}
root.FORME_LOCAL_COPIES=Object.freeze({create,MAX_KEYS,MAX_BYTES});
})(typeof window!=='undefined'?window:globalThis);
