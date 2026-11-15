/* Restore Auth before opening a local account workspace and constructing models. */
(function(root){
'use strict';
let pending,account=null,workspace=null,workspaceProblem=false,switchTarget=null;
async function start(){
 if(pending)return pending;
 pending=(async()=>{
  let raw;try{raw=root.localStorage;}catch{raw={getItem:()=>null,setItem(){throw Error('storage');},removeItem(){throw Error('storage');}};}
  const language=root.FORME_I18N?.create(raw).getLanguage()||'bg',text=key=>root.FORME_INTERFACE_TRANSLATIONS?.get('auto.'+key,language)||key;
  const node=root.document.getElementById('app');if(node){node.textContent=text('starting');node.setAttribute('aria-busy','true');}
  account=root.FORME_AUTH.create(root.FORME_AUTH_CONFIG,{language});
  if(account.get().configured)await account.start();
  let uid=account.get().user?.uid||null,pendingSwitch=false;
  try{workspace=root.FORME_WORKSPACES.open(raw,uid,root.FORME_BACKUP);}catch{
   workspaceProblem=true;
   // Keep the unmodified guest data available if the namespace migration fails.
   // Automatic synchronization is disabled until a workspace can be persisted.
   workspace=root.FORME_WORKSPACES.open(raw,null,root.FORME_BACKUP);
  }
  account.subscribe(status=>{
   const next=status.user?.uid||null;
   if(next!==uid){uid=next;pendingSwitch=true;workspace.revoke();if(node){node.textContent=text('switching');node.setAttribute('inert','');}}
   // Finish registration verification mail / account deletion before navigation.
   if(!pendingSwitch||status.busy)return;
   pendingSwitch=false;root.location.hash=next?(switchTarget==='#account'?'#account':'#home'):root.location.hash==='#privacy'?'#privacy':'#account';root.location.reload();
  });
  if(node)node.removeAttribute('aria-busy');return {account,workspace};
 })();return pending;
}
root.FORME_BOOTSTRAP=Object.freeze({start,setSwitchTarget(page){switchTarget=page;},get account(){return account;},get workspace(){return workspace;},get workspaceProblem(){return workspaceProblem;}});
})(typeof window!=='undefined'?window:globalThis);
