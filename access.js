/* Display-only account rights. Protected requests are always authorized by rules. */
(function(root){
'use strict';
const MAX_UNTIL=4102444800;
function grant(claims){
 if(!claims||typeof claims!=='object'||!Object.hasOwn(claims,'formeAccess'))return null;
 const data=claims.formeAccess;
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).sort().join(',')!=='proUntil,schema'||data.schema!==1||!Number.isInteger(data.proUntil)||data.proUntil<=0||data.proUntil>MAX_UNTIL)throw Error('invalid-claim');
 return data.proUntil;
}
function create(account,options={}){
 let uid=account?.get().user?.uid||null,verified=account?.get().user?.emailVerified===true,generation=0,busy=false,kind='unchecked',validUntil=null;
 const listeners=new Set(),online=options.isOnline||(()=>root.navigator?.onLine!==false);
 const get=()=>{const current=account?.get().user,same=!!current&&current.uid===uid&&current.emailVerified===verified;return {busy,kind:same?kind:'unchecked',validUntil:same?validUntil:null};};
 const emit=()=>{for(const listener of listeners)try{listener(get());}catch{}};
 function invalidate(reason='unchecked'){generation++;kind=reason==='offline'?'offline':'unchecked';validUntil=null;emit();}
 account?.subscribe(status=>{const next=status.user?.uid||null,nextVerified=status.user?.emailVerified===true;if(next!==uid||nextVerified!==verified){uid=next;verified=nextVerified;invalidate();}});
 const active=stamp=>{const user=account?.get().user;if(stamp!==generation||!uid||user?.uid!==uid||!user.emailVerified)throw Error('changed');};
 return Object.freeze({get,invalidate,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  async check(){
   if(busy)return {ok:false,code:'busy'};
   if(!account?.get().user)return {ok:false,code:'guest'};
   if(!account.get().user.emailVerified)return {ok:false,code:'verify'};
   if(!online()){invalidate('offline');return {ok:false,code:'offline'};}
   const stamp=generation;busy=true;kind='unchecked';validUntil=null;emit();
   try{
    const context=await account.access();active(stamp);
    if(!context||context.uid!==uid)throw Error('changed');
    const until=grant(context.claims);
    if(until===null){kind='free';return {ok:true,code:'free'};}
    const db=root.FORME_FIRESTORE.database(context);
    // An authorized get of this reserved path proves the signed grant is current
    // according to server request.time. The path need not contain a document.
    await context.sdk.getDocFromServer(context.sdk.doc(db,'users',uid,'pro','access'));active(stamp);
    kind='pro';validUntil=until*1000;return {ok:true,code:'pro'};
   }catch(error){
    const code=error?.message==='changed'?'changed':error?.message==='invalid-claim'?'invalid':['permission-denied','unauthenticated'].includes(error?.code)?'unconfirmed':['unavailable','deadline-exceeded','auth/network-request-failed'].includes(error?.code)?'offline':error?.code==='resource-exhausted'?'quota':'request';
    if(stamp===generation){kind=code;validUntil=null;}return {ok:false,code};
   }finally{busy=false;emit();}
  }
 });
}
root.FORME_ACCESS=Object.freeze({create,grant,MAX_UNTIL});
})(typeof window!=='undefined'?window:globalThis);
