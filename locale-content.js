/* Data adapter for a future complete UI translation; never mutates the original dataset. */
(function(root){
'use strict';
const supported=['bg','en','de'];
function translateContent(kind,item,language){
 if(!item||!supported.includes(language)||!['exercise','food','workout'].includes(kind))return null;
 const copy={...item,...(Array.isArray(item.ids)?{ids:[...item.ids]}:{})};
 if(language==='bg')return copy;
 const providers={exercise:root.FORME_EXERCISE_TRANSLATIONS,food:root.FORME_FOOD_TRANSLATIONS,workout:root.FORME_WORKOUT_TRANSLATIONS};
 const provider=providers[kind];if(!provider)return null;
 const content=provider.get(item.id,language);return content?{...copy,...content}:null;
}
function translateText(key,language,values){return root.FORME_INTERFACE_TRANSLATIONS?.get(key,language,values)||null;}
root.FORME_LOCALE_CONTENT=Object.freeze({translateContent,translateText});
})(typeof window!=='undefined'?window:globalThis);
