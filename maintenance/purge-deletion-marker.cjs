/* Operator-only maintenance; never imported by the app or run automatically. */
'use strict';
const PROJECT='forme-fitness-83c13',MIN_AGE=2*60*60*1000;
function assess(doc,uid,now=Date.now()){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('invalid-uid');
 const name=`projects/${PROJECT}/databases/(default)/documents/users/${uid}/private/snapshot`;
 if(doc?.name!==name||typeof doc.updateTime!=='string')throw Error('wrong-document');
 const fields=doc.fields,keys=Object.keys(fields||{}).sort();
 if(keys.join(',')!=='deletedAt,format,state'||fields.format?.integerValue!=='2'||fields.state?.stringValue!=='deleting')throw Error('not-a-deletion-marker');
 const deletedAt=Date.parse(fields.deletedAt?.timestampValue),updatedAt=Date.parse(doc.updateTime);
 if(!Number.isFinite(deletedAt)||!Number.isFinite(updatedAt)||deletedAt>now||updatedAt>now||now-Math.max(deletedAt,updatedAt)<MIN_AGE)throw Error('retention-not-elapsed');
 return {name,updateTime:doc.updateTime};
}
async function purge({uid,apply=false,now=Date.now(),loadDocument,userExists,deleteDocument}){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('invalid-uid');
 if(await userExists(uid))throw Error('auth-user-still-exists');
 const approved=assess(await loadDocument(uid),uid,now);
 if(!apply)return {eligible:true,deleted:false};
 // A second Auth check and an updateTime precondition protect the actual deletion.
 if(await userExists(uid))throw Error('auth-user-still-exists');
 await deleteDocument(approved.name,approved.updateTime);
 return {eligible:true,deleted:true};
}
async function main(){
 const args=process.argv.slice(2),position=args.indexOf('--uid'),uid=position>=0?args[position+1]:'';
 if(args.some((arg,i)=>arg!=='--apply'&&arg!=='--uid'&&i!==position+1)||!uid)throw Error('usage: --uid UID [--apply]');
 const root=process.env.FORME_FIREBASE_TOOLS_ROOT;if(!root)throw Error('set-FORME_FIREBASE_TOOLS_ROOT-to-the-official-CLI-package');
 const {getGlobalDefaultAccount}=require(root+'/lib/auth.js'),{requireAuth}=require(root+'/lib/requireAuth.js'),{Client}=require(root+'/lib/apiv2.js');
 const account=getGlobalDefaultAccount();if(!account)throw Error('Firebase-CLI-login-required');
 await requireAuth({...account,project:PROJECT,nonInteractive:true});
 const firestore=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
 const auth=new Client({urlPrefix:'https://identitytoolkit.googleapis.com',apiVersion:'v1',auth:true});
 const result=await purge({uid,apply:args.includes('--apply'),
  async userExists(id){const res=await auth.post(`/projects/${PROJECT}/accounts:lookup`,{localId:[id]});if(!res.body||Array.isArray(res.body)||typeof res.body!=='object'||res.body.error||(res.body.users!==undefined&&!Array.isArray(res.body.users)))throw Error('invalid-auth-response');return !!res.body.users?.length;},
  async loadDocument(id){return (await firestore.get(`/projects/${PROJECT}/databases/(default)/documents/users/${id}/private/snapshot`)).body;},
  async deleteDocument(name,updateTime){await firestore.delete('/'+name,{queryParams:{'currentDocument.updateTime':updateTime}});}
 });
 process.stdout.write(JSON.stringify(result)+'\n');
}
module.exports={assess,purge,MIN_AGE,PROJECT};
if(require.main===module)main().catch(()=>{process.stderr.write('Cleanup refused or failed. No document contents or credentials were logged.\n');process.exitCode=1;});
