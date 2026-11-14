/* Explicit account snapshot transfer. No background upload or persistent cloud cache. */
(function(root){
'use strict';
const MAX_RAW=12*1024*1024,MAX_PAYLOAD=700000;
const fail=code=>{const error=new Error(code);error.syncCode=code;return error;};
const encode=text=>new TextEncoder().encode(text);
async function digest(bytes){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
function canonicalText(backup,text){const archive=JSON.parse(text);if(!backup.validate(archive))throw fail('invalid');return JSON.stringify({app:'FORME',version:1,data:Object.fromEntries(Object.entries(archive.data).sort(([a],[b])=>a<b?-1:a>b?1:0))});}
function canonical(backup,storage){return canonicalText(backup,backup.exportData(storage));}
async function transform(bytes,stream,limit){const reader=new Blob([bytes]).stream().pipeThrough(stream).getReader(),parts=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw fail('large');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
function base64(bytes){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);}
async function pack(text){
 const bytes=encode(text);if(bytes.length>MAX_RAW)throw fail('large');
 const encoding=typeof CompressionStream==='function'?'gzip':'raw';
 const packed=encoding==='gzip'?await transform(bytes,new CompressionStream('gzip'),MAX_RAW):bytes;
 const payload=base64(packed);if(payload.length>MAX_PAYLOAD)throw fail('large');
 return {format:1,encoding,payload,rawBytes:bytes.length,sha256:await digest(bytes)};
}
function validMeta(value){return value&&value.format===1&&Number.isInteger(value.revision)&&value.revision>=1&&value.revision<=2000000000&&['gzip','raw'].includes(value.encoding)&&typeof value.payload==='string'&&value.payload.length>=4&&value.payload.length<=MAX_PAYLOAD&&value.payload.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(value.payload)&&Number.isInteger(value.rawBytes)&&value.rawBytes>=1&&value.rawBytes<=MAX_RAW&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)&&typeof value.createdAt?.toMillis==='function'&&typeof value.updatedAt?.toMillis==='function';}
async function unpack(value,backup){
 if(!validMeta(value))throw fail('invalid');
 const decoded=atob(value.payload),packed=Uint8Array.from(decoded,x=>x.charCodeAt(0));
 if(value.encoding==='gzip'&&typeof DecompressionStream!=='function')throw fail('unsupported');
 let bytes;try{bytes=value.encoding==='gzip'?await transform(packed,new DecompressionStream('gzip'),Math.min(MAX_RAW,value.rawBytes)):packed;}catch(error){if(error.syncCode)throw error;throw fail('invalid');}
 if(bytes.length!==value.rawBytes||bytes.length>MAX_RAW||await digest(bytes)!==value.sha256)throw fail('invalid');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let archive;try{archive=JSON.parse(text);}catch{throw fail('invalid');}
 if(!backup.validate(archive))throw fail('invalid');return text;
}
const token=value=>value?`${value.revision}|${value.sha256}|${value.createdAt.seconds}:${value.createdAt.nanoseconds}|${value.updatedAt.seconds}:${value.updatedAt.nanoseconds}`:'';
function errorCode(error){return error?.syncCode||(error?.code==='aborted'?'conflict':['permission-denied','unauthenticated'].includes(error?.code)?'permission':['unavailable','deadline-exceeded','auth/network-request-failed'].includes(error?.code)?'offline':error?.code==='resource-exhausted'?'quota':'request');}
function create(account,storage,backup,options={}){
 let uid=account?.get().user?.uid||null,generation=0,busy=false,checked=false,remote=null,remoteText=null,permit=null,problem=null,localSummary=null,remoteSummary=null,db=null,sdk=null;
 const listeners=new Set(),online=options.isOnline||(()=>root.navigator?.onLine!==false);
 const get=()=>({busy,checked,exists:!!remote,revision:remote?.revision||0,updatedAt:remote?.updatedAt?.toMillis?.()||null,summary:remoteSummary?{...remoteSummary}:null,localSummary:localSummary?{...localSummary}:null,canRestore:!!permit,problem});
 const emit=()=>{for(const listener of listeners)try{listener(get());}catch{}};
 function clear(){checked=false;remote=null;remoteText=null;permit=null;localSummary=null;remoteSummary=null;}
 account?.subscribe(status=>{const next=status.user?.uid||null;if(next!==uid){uid=next;generation++;clear();problem=null;emit();}});
 const assertActive=stamp=>{const user=account?.get().user;if(generation!==stamp||!user||user.uid!==uid)throw fail('changed');if(!user.emailVerified)throw fail('verify');};
 async function client(stamp){assertActive(stamp);const context=await account.client();assertActive(stamp);if(!context||context.uid!==uid)throw fail('changed');sdk=context.sdk;if(!db){db=sdk.initializeFirestore(context.app,{localCache:sdk.memoryLocalCache()});if(context.emulator)sdk.connectFirestoreEmulator(db,'127.0.0.1',8080);}return sdk.doc(db,'users',uid,'private','snapshot');}
 async function run(operation){
  if(busy)return {ok:false,code:'busy'};
  const stamp=generation;busy=true;problem=null;emit();
  try{if(!online())throw fail('offline');assertActive(stamp);const ref=await client(stamp);assertActive(stamp);return await operation(ref,stamp);}
  catch(error){const code=errorCode(error);if(stamp===generation){clear();problem=code;}return {ok:false,code};}
  finally{busy=false;emit();}
 }
 async function read(ref,stamp){const result=await sdk.getDocFromServer(ref);assertActive(stamp);const value=result.exists()?result.data():null;if(value&&!validMeta(value))throw fail('invalid');return value;}
 return Object.freeze({get,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  check:()=>run(async(ref,stamp)=>{const value=await read(ref,stamp),text=value?await unpack(value,backup):null;assertActive(stamp);remote=value;remoteText=text;remoteSummary=text?backup.summarizeArchive(text):null;permit=null;localSummary=backup.summarizeArchive(backup.exportData(storage));checked=true;return {ok:true,code:value?'found':'empty'};}),
  upload(consent){return run(async(ref,stamp)=>{
   if(consent!==true)throw fail('consent');if(!checked)throw fail('check');
   const expected=token(remote),text=canonical(backup,storage),prepared=await pack(text);assertActive(stamp);
   await sdk.runTransaction(db,async transaction=>{const snap=await transaction.get(ref);assertActive(stamp);const current=snap.exists()?snap.data():null;if(token(current)!==expected)throw fail('conflict');transaction.set(ref,{...prepared,revision:(current?.revision||0)+1,createdAt:current?.createdAt||sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});},{maxAttempts:1});
   assertActive(stamp);const saved=await read(ref,stamp);if(!saved||saved.sha256!==prepared.sha256)throw fail('request');remote=saved;remoteText=text;permit=null;checked=true;localSummary=backup.summarizeArchive(text);remoteSummary=localSummary;return {ok:true,code:'uploaded'};
  });},
  download(){if(!uid||!checked||!remoteText||account.get().user?.uid!==uid)return {ok:false,code:'check'};return {ok:true,text:remoteText};},
  async safetyExport(){
   const stamp=generation;try{assertActive(stamp);if(!checked||!remoteText)throw fail('check');const text=backup.exportData(storage),fingerprint=await digest(encode(canonicalText(backup,text)));assertActive(stamp);permit={fingerprint,token:token(remote)};emit();return {ok:true,text};}catch(error){return {ok:false,code:errorCode(error)};}
  },
  restore(consent){return run(async(ref,stamp)=>{
   if(consent!==true)throw fail('consent');if(!checked||!remoteText||!permit)throw fail('backup');
   const saved=await read(ref,stamp);if(token(saved)!==permit.token)throw fail('conflict');
   const local=canonical(backup,storage);if(await digest(encode(local))!==permit.fingerprint||canonical(backup,storage)!==local)throw fail('localChanged');assertActive(stamp);
   const text=remoteText;permit=null;if(!backup.importData(storage,text))throw fail('storage');return {ok:true,code:'restored'};
  });}
 });
}
root.FORME_CLOUD=Object.freeze({create,pack,unpack,canonical,errorCode,MAX_RAW,MAX_PAYLOAD});
})(typeof window!=='undefined'?window:globalThis);
