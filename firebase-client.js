/* One memory-only Firestore instance shared by explicit account operations. */
(function(root){
'use strict';
const clients=new WeakMap();
function database(context){
 if(!context?.app||!context.sdk)throw Error('firebase-context-missing');
 const existing=clients.get(context.app);
 if(existing){if(existing.sdk!==context.sdk||existing.emulator!==!!context.emulator)throw Error('firebase-context-mismatch');return existing.db;}
 const {sdk,app}=context,db=sdk.initializeFirestore(app,{localCache:sdk.memoryLocalCache()});
 if(context.emulator)sdk.connectFirestoreEmulator(db,'127.0.0.1',8080);
 clients.set(app,{sdk,db,emulator:!!context.emulator});return db;
}
root.FORME_FIRESTORE=Object.freeze({database});
})(typeof window!=='undefined'?window:globalThis);
