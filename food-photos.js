/* FORME-generated food imagery. Each ID has its own local, responsive file. */
(function(root){
'use strict';
const ids=["chicken","turkey","egg","tuna","salmon","greek","cottage","oats","rice","brownrice","quinoa","bread","potato","lentils","avocado","almonds","walnuts","oliveoil","peanutbutter","chocolate","banana","apple","orange","blueberry","strawberry","broccoli","spinach","carrot","tomato","cucumber"];
const photos=Object.freeze(Object.fromEntries(ids.map(id=>[id,Object.freeze({
  origin:'ai',generator:'OpenAI image generation tool',created:id==='banana'?'2026-11-08':'2026-11-07',
  small:`media/foods/${id==='banana'?'banana-v3':id}-480.webp`,large:`media/foods/${id==='banana'?'banana-v3':id}-960.webp`
})])));
root.FORME_FOOD_PHOTOS=Object.freeze({get(id){return Object.prototype.hasOwnProperty.call(photos,id)?photos[id]:null;},ids});
})(typeof window!=='undefined'?window:globalThis);
