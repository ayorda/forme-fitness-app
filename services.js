/* Future services: public catalogue and server-only, read-only data contracts.
 * No purchase, trainer enrolment, consent capture or private media intake. */
(function(root){
'use strict';
const PROGRAMS=Object.freeze(['muscle-up','handstand','front-lever']);
const MAX_TIME=4102444800000;
const exact=(data,keys)=>!!data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).sort().join(',')===keys.split(',').sort().join(',');
const uid=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!value.includes('/');
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(value);
const time=value=>{const result=value?.toMillis?.();if(!Number.isFinite(result)||result<0||result>MAX_TIME)throw Error('invalid');return result;};
function validate(kind,data,scope){
 let result;
 if(kind==='grant'){
  if(!exact(data,'schema,programId,state,grantedAt,updatedAt')||data.schema!==1||!PROGRAMS.includes(data.programId)||data.programId!==scope.programId||!['active','revoked'].includes(data.state))throw Error('invalid');
  result={...data,grantedAt:time(data.grantedAt),updatedAt:time(data.updatedAt)};
  if(result.grantedAt>result.updatedAt)throw Error('invalid');
 }else if(kind==='program'){
  if(!exact(data,'schema,programId,versionId,body,updatedAt')||data.schema!==1||!PROGRAMS.includes(data.programId)||data.programId!==scope.programId||!id(data.versionId)||data.versionId!==scope.versionId||!exact(data.body,'bg,en,de')||!Object.values(data.body).every(value=>typeof value==='string'&&value.length>0&&value.length<=50000))throw Error('invalid');
  result={...data,body:Object.freeze({...data.body}),updatedAt:time(data.updatedAt)};
 }else if(kind==='assignment'){
  if(!exact(data,'schema,clientUid,coachUid,state,startsAt,endsAt,consent,consentAt,updatedAt')||data.schema!==1||!uid(data.clientUid)||!uid(data.coachUid)||data.clientUid===data.coachUid||![data.clientUid,data.coachUid].includes(scope.uid)||!['active','paused','ended'].includes(data.state)||typeof data.consent!=='boolean')throw Error('invalid');
  result={...data,startsAt:time(data.startsAt),endsAt:time(data.endsAt),consentAt:time(data.consentAt),updatedAt:time(data.updatedAt)};
  if(result.startsAt>=result.endsAt||result.consentAt>result.updatedAt)throw Error('invalid');
 }else if(kind==='note'){
  if(!exact(data,'schema,engagementId,clientUid,coachUid,kind,body,createdAt,updatedAt')||data.schema!==1||!id(data.engagementId)||data.engagementId!==scope.engagementId||!uid(data.clientUid)||!uid(data.coachUid)||data.clientUid===data.coachUid||![data.clientUid,data.coachUid].includes(scope.uid)||!['plan','feedback'].includes(data.kind)||typeof data.body!=='string'||data.body.length<1||data.body.length>20000)throw Error('invalid');
  result={...data,createdAt:time(data.createdAt),updatedAt:time(data.updatedAt)};
  if(result.createdAt>result.updatedAt)throw Error('invalid');
 }else throw Error('invalid');
 return Object.freeze(result);
}
function create(account,options={}){
 let generation=0;
 const online=options.isOnline||(()=>root.navigator?.onLine!==false);
 let identity=account?.get().user;
 account?.subscribe(status=>{if(status.user?.uid!==identity?.uid||status.user?.emailVerified!==identity?.emailVerified)generation++;identity=status.user;});
 async function read(kind,segments,scope){
  const user=account?.get().user,stamp=generation;
  if(!user)return {ok:false,code:'guest'};
  if(!user.emailVerified)return {ok:false,code:'verify'};
  if(!online())return {ok:false,code:'offline'};
  const active=()=>{const current=account?.get().user;if(stamp!==generation||current?.uid!==user.uid||!current.emailVerified)throw Error('changed');if(!online())throw Error('offline');};
  try{
   const context=await account.client();active();
   if(context?.uid!==user.uid)throw Error('changed');
   const db=root.FORME_FIRESTORE.database(context);
   const snapshot=await context.sdk.getDocFromServer(context.sdk.doc(db,...segments(user.uid)));active();
   if(!snapshot.exists())return {ok:false,code:'missing'};
   return {ok:true,data:validate(kind,snapshot.data(),{...scope,uid:user.uid})};
  }catch(error){
   const code=['changed','invalid','offline'].includes(error?.message)?error.message:['permission-denied','unauthenticated'].includes(error?.code)?'permission':['unavailable','deadline-exceeded','auth/network-request-failed'].includes(error?.code)?'offline':error?.code==='resource-exhausted'?'quota':'request';
   return {ok:false,code};
  }
 }
 const bad=()=>Promise.resolve({ok:false,code:'input'});
 return Object.freeze({
  readGrant(programId){return PROGRAMS.includes(programId)?read('grant',current=>['users',current,'programs',programId],{programId}):bad();},
  readProgram(programId,versionId){return PROGRAMS.includes(programId)&&id(versionId)?read('program',()=>['program-content',programId,'versions',versionId],{programId,versionId}):bad();},
  readAssignment(engagementId){return id(engagementId)?read('assignment',()=>['coaching',engagementId],{}):bad();},
  readNote(engagementId,noteId){return id(engagementId)&&id(noteId)?read('note',()=>['coaching',engagementId,'notes',noteId],{engagementId}):bad();}
 });
}
root.FORME_SERVICES=Object.freeze({PROGRAMS,MAX_TIME,validate,create});
})(typeof window!=='undefined'?window:globalThis);
