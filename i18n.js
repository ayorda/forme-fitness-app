/* Translation foundation. The language selector stays hidden until content is translated. */
(function(root){
'use strict';
const storageKey='forme-language';
const languages=Object.freeze(['bg','en','de']);
const messages=Object.freeze({
 bg:Object.freeze({languageName:'Български',languageLabel:'Език',unavailable:'Съдържанието не е налично.'}),
 en:Object.freeze({languageName:'English',languageLabel:'Language',unavailable:'Content is unavailable.'}),
 de:Object.freeze({languageName:'Deutsch',languageLabel:'Sprache',unavailable:'Der Inhalt ist nicht verfügbar.'})
});
function create(storage){
 let language='bg';
 try{const saved=storage&&storage.getItem(storageKey);if(languages.includes(saved))language=saved;}catch{}
 return Object.freeze({
  getLanguage(){return language;},
  setLanguage(value){if(!languages.includes(value))return false;language=value;try{if(storage)storage.setItem(storageKey,value);}catch{}return true;},
  translate(key){return messages[language][key]??messages.bg[key]??null;}
 });
}
root.FORME_I18N=Object.freeze({create,languages,messages});
})(typeof window!=='undefined'?window:globalThis);
