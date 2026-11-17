/* Keep the existing custom dialogs isolated without changing their data/lifecycle. */
(function(root){
'use strict';
function create(options={}){
 const doc=options.document||root.document,container=options.container;
 const defer=options.defer||root.queueMicrotask?.bind(root)||(fn=>Promise.resolve().then(fn));
 const saved=new Map();let active=false,disposed=false,redirecting=false,revision=0;
 function dialog(){return container?.querySelector?.('[role="dialog"],[role="alertdialog"]');}
 function focusInside(){
  const current=dialog();
  if(!current||current.contains(doc.activeElement)||redirecting)return;
  redirecting=true;
  try{(current.querySelector('.modal-close')||current).focus({preventScroll:true});}finally{redirecting=false;}
 }
 function onFocus(event){if(active&&!container.contains(event.target))focusInside();}
 function close(){
  active=false;revision++;
  for(const [element,attributes] of saved){
   for(const name of ['inert','aria-hidden']){
    const value=attributes[name];if(value===null)element.removeAttribute(name);else element.setAttribute(name,value);
   }
  }
  saved.clear();
 }
 function open({deferFocus=false}={}){
  if(disposed)return false;
  if(!dialog()){close();return false;}
  active=true;const token=++revision;
  const backgrounds=Array.from(doc.querySelectorAll('.shell,.skip-link')).filter(element=>element!==container&&!element.contains(container));
  // Move focus first: aria-hidden must never hide the focused trigger.
  // A rerender may restore its own input synchronously, so allow that first.
  if(!deferFocus||backgrounds.some(element=>element.contains(doc.activeElement)))focusInside();
  for(const element of backgrounds){
   if(!saved.has(element))saved.set(element,{'inert':element.getAttribute('inert'),'aria-hidden':element.getAttribute('aria-hidden')});
   element.setAttribute('inert','');element.setAttribute('aria-hidden','true');
  }
  if(deferFocus)defer(()=>{if(active&&revision===token)focusInside();});
  return true;
 }
 function dispose(){close();disposed=true;doc?.removeEventListener('focusin',onFocus,true);}
 doc?.addEventListener('focusin',onFocus,true);
 return Object.freeze({open,close,dispose});
}
root.FORME_MODAL_ACCESSIBILITY=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
