/* Authentication delegates to the pinned official SDK; workout data remains local. */
(function(root){
'use strict';
const sdkPath='./vendor/firebase-auth-13.3.0.js';
const validEmail=value=>typeof value==='string'&&value.trim().length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const validPassword=value=>typeof value==='string'&&value.length>=12&&value.length<=128;
function configStatus(config,environment={}){
 if(!config||config.enabled!==true)return 'unconfigured';
 if(Object.keys(config).some(key=>!['enabled','apiKey','authDomain','projectId','appId','emulatorUrl'].includes(key)))return 'configuration';
 if(typeof config.projectId!=='string'||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)||typeof config.apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{35}$/.test(config.apiKey)||typeof config.appId!=='string'||!/^1:\d+:web:[a-f0-9]+$/.test(config.appId)||config.authDomain!==config.projectId+'.firebaseapp.com')return 'configuration';
 if(config.emulatorUrl){if(!['localhost','127.0.0.1','[::1]'].includes(environment.hostname)||config.emulatorUrl!=='http://127.0.0.1:9099'||!config.projectId.startsWith('demo-'))return 'configuration';}
 else if(environment.protocol!=='https:')return 'configuration';
 return 'configured';
}
function errorCode(error){const code=error?.code;return ['auth/invalid-credential','auth/user-not-found','auth/wrong-password','auth/user-disabled'].includes(code)?'credentials':code==='auth/too-many-requests'?'rate':code==='auth/network-request-failed'?'offline':code==='auth/weak-password'?'password':code==='auth/invalid-email'?'email':['auth/operation-not-allowed','auth/invalid-api-key','auth/unauthorized-domain','auth/app-not-authorized'].includes(code)?'configuration':'request';}
function create(config={},options={}){
 const environment=options.environment||{hostname:root.location?.hostname,protocol:root.location?.protocol};
 const configured=configStatus(config,environment),isOnline=options.isOnline||(()=>root.navigator?.onLine!==false),loadSdk=options.loadSdk||(()=>import(sdkPath));
 let sdk=null,auth=null,initialization=null,busy=false,user=null,started=false,problem=configured==='configuration'?'configuration':null;
 const listeners=new Set();
 const snapshot=()=>({configured:configured==='configured',status:configured!=='configured'?configured:busy?'loading':!started?(problem?'error':'idle'):user?'authenticated':'guest',busy,user:user?{uid:user.uid,email:typeof user.email==='string'?user.email:'',emailVerified:user.emailVerified===true}:null,problem});
 const emit=()=>{for(const listener of listeners)try{listener(snapshot());}catch{}};
 async function ensure(){
  if(auth&&started)return;
  if(initialization)return initialization;
  initialization=(async()=>{
   sdk=await loadSdk();
   if(!auth){const app=sdk.initializeApp({apiKey:config.apiKey,authDomain:config.authDomain,projectId:config.projectId,appId:config.appId},'forme-account');auth=sdk.initializeAuth(app,{persistence:sdk.browserSessionPersistence});
    if(config.emulatorUrl)sdk.connectAuthEmulator(auth,config.emulatorUrl,{disableWarnings:true});
    sdk.onAuthStateChanged(auth,next=>{user=next;emit();},()=>{user=null;problem='request';emit();});
   }
   await auth.authStateReady();user=auth.currentUser;started=true;
  })();
  try{await initialization;}finally{initialization=null;}
 }
 async function run(operation,online=true){
  if(configured!=='configured')return {ok:false,code:configured};
  if(busy)return {ok:false,code:'busy'};
  if(online&&!isOnline())return {ok:false,code:'offline'};
  busy=true;problem=null;emit();
  try{await ensure();return await operation();}catch(error){const code=errorCode(error);problem=code;return {ok:false,code};}finally{busy=false;emit();}
 }
 return Object.freeze({get:snapshot,subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},start:()=>run(async()=>({ok:true}),false),
  login(email,password){if(!validEmail(email))return Promise.resolve({ok:false,code:'email'});if(typeof password!=='string'||!password.length||password.length>4096)return Promise.resolve({ok:false,code:'password'});return run(async()=>{const result=await sdk.signInWithEmailAndPassword(auth,email.trim(),password);user=result.user;return {ok:true,code:'signedIn'};});},
  signup(email,password){if(!validEmail(email))return Promise.resolve({ok:false,code:'email'});if(!validPassword(password))return Promise.resolve({ok:false,code:'password'});return run(async()=>{const result=await sdk.createUserWithEmailAndPassword(auth,email.trim(),password);user=result.user;sdkLanguage();try{await sdk.sendEmailVerification(user);return {ok:true,code:'created'};}catch{return {ok:true,code:'createdEmailPending'};}});},
  reset(email){if(!validEmail(email))return Promise.resolve({ok:false,code:'email'});return run(async()=>{sdkLanguage();try{await sdk.sendPasswordResetEmail(auth,email.trim());}catch(error){if(error?.code!=='auth/user-not-found')throw error;}return {ok:true,code:'resetSent'};});},
  verify:()=>run(async()=>{if(!user)return {ok:false,code:'signedOut'};if(user.emailVerified)return {ok:true,code:'verified'};sdkLanguage();await sdk.sendEmailVerification(user);return {ok:true,code:'verificationSent'};}),
  refresh:()=>run(async()=>{if(!auth.currentUser)return {ok:false,code:'signedOut'};await sdk.reload(auth.currentUser);user=auth.currentUser;return {ok:true,code:user?.emailVerified?'verified':'verificationPending'};}),
  logout:()=>run(async()=>{await sdk.signOut(auth);user=null;return {ok:true,code:'signedOut'};},false)
 });
 function sdkLanguage(){if(auth)auth.languageCode=['bg','en','de'].includes(options.language)?options.language:'bg';}
}
root.FORME_AUTH=Object.freeze({create,configStatus,errorCode,validEmail,validPassword,sdkPath});
})(typeof window!=='undefined'?window:globalThis);
