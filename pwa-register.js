/* External registration keeps the app shell free of executable inline code. */
(function(root){
'use strict';
if('serviceWorker' in root.navigator&&root.location.protocol!=='file:'){
 root.addEventListener('load',()=>{
  root.navigator.serviceWorker.register('./service-worker.js').catch(error=>{
   root.console.warn('Неуспешна регистрация за офлайн достъп:',error);
  });
 });
}
})(window);
