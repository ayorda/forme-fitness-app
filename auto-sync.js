/* Automatic, consented account sync. Durable local records; foreground realtime. */
(function(root){
'use strict';
const META='forme-auto-v1';
const failure=code=>{const e=Error(code);e.autoCode=code;return e;};
const codeFor=e=>e?.autoCode||(['QuotaExceededError','SecurityError'].includes(e?.name)?'storage':['changed','invalid','large','unsupported'].includes(e?.message)?e.message:root.FORME_CLOUD.errorCode(e));
function create(account,workspace,backup,options={}){
 const R=root.FORME_SYNC_RECORDS,uid=workspace?.uid,listeners=new Set();
 const online=options.isOnline||(()=>root.navigator?.onLine!==false),visible=options.isVisible||(()=>!root.document?.hidden),canApply=options.canApply||(()=>true),onApplied=options.onApplied||(()=>{});
 const lock=options.withLock||(root.navigator?.locks?((name,fn)=>root.navigator.locks.request(name,{mode:'exclusive'},fn)):null);
 const later=options.setTimeout||root.setTimeout?.bind(root),cancel=options.clearTimeout||root.clearTimeout?.bind(root);
 let memo=null,enabled=false,paused=false,busy=false,pending=false,deferred=false,problem=null,lastSync=null,epoch=0,stopped=false,blocked=false,applying=false,timer=null,unsubscribe=null,context=null,db=null,knownRevision=null,retry=0;
 const identity=()=>{const user=account?.get().user;return !!uid&&workspace.active()&&user?.uid===uid&&user.emailVerified===true;};
 const get=()=>({enabled:identity()&&enabled,paused:identity()&&paused,busy,pending:identity()&&pending,deferred:identity()&&deferred,problem:identity()?problem:null,lastSync:identity()?lastSync:null});
 const emit=()=>{for(const listener of listeners)try{listener(get());}catch{}};
 const active=stamp=>{if(stamp!==epoch||stopped||paused||!identity())throw failure('changed');};
 const locked=fn=>{if(!lock)throw failure('unsupported');return lock('forme-auto:'+uid,fn);};
 function fresh(){const bytes=new Uint8Array(16);root.crypto.getRandomValues(bytes);return {version:1,actor:Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join(''),enabled:false,paused:false,records:{},base:{},lastSync:null};}
 function load(){
  const raw=workspace.getMeta(META);if(raw===null)return memo||(memo=fresh());
  let value;try{value=JSON.parse(raw);}catch{throw failure('invalid');}
  if(value?.version!==1||!R.actor(value.actor)||typeof value.enabled!=='boolean'||typeof value.paused!=='boolean'||!value.base||typeof value.base!=='object'||Array.isArray(value.base)||Object.keys(value.base).length>R.MAX_RECORDS||!Object.keys(value.base).every(R.validKey)||!R.valid({app:'FORME_SYNC',version:1,enabled:true,records:value.records})||value.lastSync!==null&&(!Number.isFinite(value.lastSync)||value.lastSync<0))throw failure('invalid');
  memo=value;return value;
 }
 function save(value){workspace.setMeta(META,JSON.stringify(value));memo=value;enabled=value.enabled;paused=value.paused;lastSync=value.lastSync;}
 const archive=()=>JSON.parse(backup.exportData(workspace.transfer));
 const sourceToken=value=>R.stable(value.data);
 async function capture(value){
  const current=archive(),flat=await R.flatten(current);
  value.records=R.changes(value.records,value.base,flat,value.actor);value.base=flat;
  return {current,flat};
 }
 async function client(stamp){
  active(stamp);context=await account.client();active(stamp);if(!context||context.uid!==uid)throw failure('changed');
  db=root.FORME_FIRESTORE.database(context);return context.sdk.doc(db,'users',uid,'private','auto');
 }
 async function decode(document){
  if(!document)return null;
  const text=await root.FORME_CLOUD.unpack(document,{validate:R.valid}),state=JSON.parse(text);await R.validateState(state);return state;
 }
 const token=value=>value?`${value.revision}|${value.sha256}|${value.createdAt.seconds}:${value.createdAt.nanoseconds}|${value.updatedAt.seconds}:${value.updatedAt.nanoseconds}`:'';
 function detach(){if(unsubscribe){unsubscribe();unsubscribe=null;}if(timer!==null){cancel?.(timer);timer=null;}}
 function schedule(delay=1000){
  if(stopped||blocked||paused||!identity())return;if(timer!==null)cancel?.(timer);
  timer=later?.(()=>{timer=null;void sync();},delay);
 }
 function listen(ref,stamp){
  if(unsubscribe||!context?.sdk.onSnapshot||!enabled||!visible()||!online())return;
  unsubscribe=context.sdk.onSnapshot(ref,snapshot=>{
   if(stamp!==epoch||!identity()||snapshot.metadata?.fromCache||snapshot.metadata?.hasPendingWrites)return;
   const revision=snapshot.exists()?snapshot.data().revision:null;
   if(revision!==knownRevision)schedule(100);
  },error=>{if(stamp!==epoch)return;problem=codeFor(error);if(['permission','quota'].includes(problem)){blocked=true;detach();}emit();if(!blocked)schedule(30000);});
 }
 async function apply(value,stamp){
  const captured=await capture(value);active(stamp);save(value);
  if(!canApply()){deferred=true;return;}
  const target=R.materialize(value.records,captured.current),flat=await R.flatten(target);active(stamp);
  if(sourceToken(archive())!==sourceToken(captured.current)){pending=true;schedule(100);return;}
  if(sourceToken(target)!==sourceToken(captured.current)){
   applying=true;try{if(!backup.importData(workspace.transfer,JSON.stringify(target)))throw failure('storage');onApplied();}finally{applying=false;}
  }
  value.base=flat;save(value);deferred=false;
 }
 async function sync(){
  if(busy){schedule(1500);return {ok:false,code:'busy'};}
  if(!identity()||stopped||paused)return {ok:false,code:'inactive'};
  const stamp=epoch;busy=true;problem=null;emit();
  try{
   await locked(async()=>{
    active(stamp);let local=load();enabled=local.enabled;paused=local.paused;lastSync=local.lastSync;if(paused)return;
    if(enabled){await capture(local);active(stamp);save(local);pending=true;}
    if(!online())throw failure('offline');if(!visible())return;
    const ref=await client(stamp),snapshot=await context.sdk.getDocFromServer(ref);active(stamp);
    const head=snapshot.exists()?snapshot.data():null,remote=await decode(head);active(stamp);knownRevision=head?.revision||null;
    if(!enabled){
     if(!remote){problem='off';return;}
     const current=await R.flatten(archive());active(stamp);
     if(Object.keys(current).length){problem='consent';return;}
     local.enabled=true;local.base=current;enabled=true;
    }
    await capture(local);active(stamp);local.records=R.join(local.records,remote?.records||{});save(local);
    if(!head||!R.same(local.records,remote?.records||{})){
     const records=local.records,prepared=await root.FORME_CLOUD.pack(JSON.stringify({app:'FORME_SYNC',version:1,enabled:true,records}));active(stamp);
     const expected=token(head);knownRevision=(head?.revision||0)+1;
     try{
      await context.sdk.runTransaction(db,async transaction=>{
       const current=await transaction.get(ref);active(stamp);const data=current.exists()?current.data():null;
       if(token(data)!==expected)throw failure('conflict');
       transaction.set(ref,{...prepared,revision:(data?.revision||0)+1,createdAt:data?.createdAt||context.sdk.serverTimestamp(),updatedAt:context.sdk.serverTimestamp()});
      },{maxAttempts:1});
     }catch(error){
      // A concurrent revision can fail strict rules before the backend reports
      // ABORTED. Confirm a changed head with an authorized server read; genuine
      // permission failures stay failures and never bypass the rules.
      if(error?.code==='permission-denied'){
       const latest=await context.sdk.getDocFromServer(ref);active(stamp);
       if(token(latest.exists()?latest.data():null)!==expected)throw failure('conflict');
      }
      throw error;
     }
     active(stamp);
    }
    const acknowledged=local.records;local.lastSync=Date.now();pending=false;await apply(local,stamp);active(stamp);
    // New local edits made during network/decoding remain queued, not acknowledged.
    if(!R.same(local.records,acknowledged)){pending=true;schedule(100);}
    blocked=false;retry=0;listen(ref,stamp);
   });
   return {ok:true,code:enabled?'synced':'off'};
  }catch(error){
   const code=codeFor(error);if(stamp===epoch){problem=code;pending=enabled;if(['permission','quota','invalid','large','unsupported','storage'].includes(code)){blocked=true;detach();}if(code!=='changed'&&!['permission','quota','invalid','large','unsupported','storage'].includes(code)&&online()&&visible())schedule(Math.min(60000,2000*2**Math.min(retry++,5)));}
   return {ok:false,code};
  }finally{busy=false;emit();}
 }
 function stop(){epoch++;stopped=true;detach();}
 account?.subscribe(()=>{if(!identity())stop();});
 workspace?.subscribe(key=>{if(applying||!R.KEYS.includes(key))return;pending=enabled;emit();if(enabled)schedule();});
 const model=Object.freeze({get,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  async start(){
   if(!identity())return {ok:false,code:uid?'verify':'guest'};
   if(unsubscribe&&enabled&&!paused&&!stopped)return {ok:true,code:'active'};
   try{const local=load();enabled=local.enabled;paused=local.paused;lastSync=local.lastSync;if(paused){emit();return {ok:true,code:'paused'};}stopped=false;blocked=false;return await sync();}catch(error){problem=codeFor(error);emit();return {ok:false,code:problem};}
  },
  async enable(consent){
   if(consent!==true)return {ok:false,code:'consent'};if(!identity())return {ok:false,code:'verify'};
   try{await locked(async()=>{const local=load();local.enabled=true;local.paused=false;await capture(local);save(local);});stopped=false;blocked=false;paused=false;pending=true;await sync();return {ok:true,code:'enabled'};}catch(error){problem=codeFor(error);emit();return {ok:false,code:problem};}
  },
  async pause(){stop();paused=true;try{await locked(()=>{const local=load();local.paused=true;save(local);});emit();return {ok:true,code:'paused'};}catch(error){problem=codeFor(error);emit();return {ok:false,code:problem};}},
  async resume(){stopped=false;blocked=false;paused=false;try{await locked(()=>{const local=load();local.paused=false;save(local);});return await sync();}catch(error){problem=codeFor(error);emit();return {ok:false,code:problem};}},
  async forget(){stop();try{await locked(()=>{const local=load();local.records={};local.base={};local.enabled=false;local.paused=true;save(local);});emit();return true;}catch{return false;}},
  wake(){if(blocked)return;if(!visible()||!online()){detach();emit();return;}if(enabled&&!paused&&!stopped)schedule(0);else if(!enabled&&!paused&&!stopped)void model.start();},
  flush:sync,stop
 });return model;
}
root.FORME_AUTO=Object.freeze({create,META});
})(typeof window!=='undefined'?window:globalThis);
