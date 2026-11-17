const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('modal-accessibility.js','utf8'),context);
 const listeners={},tasks=[];let hasDialog=true;
 const doc={activeElement:null,addEventListener:(name,fn)=>{listeners[name]=fn;},removeEventListener:(name,fn)=>{if(listeners[name]===fn)delete listeners[name];}};
 function node(children=[]){const attrs=new Map();return {children,attrs,focusCalls:0,contains(el){return el===this||children.includes(el);},getAttribute(name){return attrs.get(name)??null;},setAttribute(name,value){attrs.set(name,value);},removeAttribute(name){attrs.delete(name);},focus(){this.focusCalls++;doc.activeElement=this;listeners.focusin?.({target:this});}};}
 const trigger=node(),input=node(),close=node(),dialog=node([input,close]),shell=node([trigger]),skip=node(),toast=node(),body=node();
 dialog.querySelector=selector=>selector==='.modal-close'?close:null;
 const container=node([dialog,input,close]);container.querySelector=()=>hasDialog?dialog:null;
 doc.querySelectorAll=selector=>{assert.equal(selector,'.shell,.skip-link');return [shell,skip];};doc.activeElement=trigger;
 const manager=context.window.FORME_MODAL_ACCESSIBILITY.create({document:doc,container,defer:task=>tasks.push(task)});
 return {manager,doc,container,dialog,trigger,input,close,shell,skip,toast,body,listeners,tasks,flush(){while(tasks.length)tasks.shift()();},removeDialog(){hasDialog=false;}};
}

test('opening moves focus before isolating background roots, leaving live announcements available',()=>{
 const f=fixture();const set=f.shell.setAttribute.bind(f.shell);
 f.shell.setAttribute=(name,value)=>{if(name==='aria-hidden')assert.ok(f.dialog.contains(f.doc.activeElement));set(name,value);};
 assert.equal(f.manager.open(),true);assert.equal(f.doc.activeElement,f.close);
 for(const el of [f.shell,f.skip]){assert.equal(el.getAttribute('inert'),'');assert.equal(el.getAttribute('aria-hidden'),'true');}
 assert.equal(f.toast.attrs.size,0);assert.equal(f.container.attrs.size,0);
});

test('repeated dialog replacement preserves original inert and aria-hidden states for close',()=>{
 const f=fixture();f.shell.setAttribute('aria-hidden','false');f.skip.setAttribute('inert','already-set');
 f.manager.open();f.manager.open();f.manager.close();
 assert.equal(f.shell.getAttribute('aria-hidden'),'false');assert.equal(f.shell.getAttribute('inert'),null);
 assert.equal(f.skip.getAttribute('inert'),'already-set');assert.equal(f.skip.getAttribute('aria-hidden'),null);
 f.manager.close();assert.equal(f.skip.getAttribute('inert'),'already-set');
});

test('focus guard catches programmatic background focus even without native inert support',()=>{
 const f=fixture();f.manager.open();f.input.focus();assert.equal(f.doc.activeElement,f.input);
 f.trigger.focus();assert.equal(f.doc.activeElement,f.close);
 f.manager.close();f.trigger.focus();assert.equal(f.doc.activeElement,f.trigger);
});

test('a rerender can restore its input before deferred fallback without losing its focus',()=>{
 const f=fixture();f.manager.open();f.doc.activeElement=f.body;
 f.manager.open({deferFocus:true});f.input.focus();const count=f.close.focusCalls;f.flush();
 assert.equal(f.doc.activeElement,f.input);assert.equal(f.close.focusCalls,count);
});

test('a rerender with no restored control recovers dialog focus instead of leaving it on body',()=>{
 const f=fixture();f.manager.open();f.doc.activeElement=f.body;f.manager.open({deferFocus:true});
 assert.equal(f.doc.activeElement,f.body);f.flush();assert.equal(f.doc.activeElement,f.close);
});

test('missing dialog releases the background rather than leaving the application inert',()=>{
 const f=fixture();f.manager.open();f.removeDialog();assert.equal(f.manager.open(),false);
 assert.equal(f.shell.getAttribute('inert'),null);assert.equal(f.skip.getAttribute('aria-hidden'),null);
});

test('stale deferred work cannot steal restored focus after close or a later dialog cycle',()=>{
 const f=fixture();f.manager.open({deferFocus:true});f.manager.close();f.trigger.focus();f.flush();assert.equal(f.doc.activeElement,f.trigger);
 f.manager.open({deferFocus:true});const stale=f.tasks.shift();f.manager.close();f.manager.open();f.input.focus();stale();assert.equal(f.doc.activeElement,f.input);
});

test('disposing restores background state, detaches the focus listener and prevents reactivation',()=>{
 const f=fixture();f.manager.open();f.manager.dispose();assert.equal(f.shell.getAttribute('inert'),null);assert.equal(f.listeners.focusin,undefined);
 assert.equal(f.manager.open(),false);f.trigger.focus();assert.equal(f.doc.activeElement,f.trigger);
});
