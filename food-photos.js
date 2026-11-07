/* Selected Pexels photos; labels describe reference foods, not a weighed serving. */
(function(root){
'use strict';
const photos=Object.freeze({
 rice:Object.freeze({src:'https://images.pexels.com/photos/17563535/pexels-photo-17563535/free-photo-of-rice.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/rice-17563535/',credit:'Jubair Bin Iqbal / Pexels'}),
 chicken:Object.freeze({src:'https://images.pexels.com/photos/6107734/pexels-photo-6107734.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/close-up-photo-of-a-raw-chicken-meat-6107734/',credit:'alleksana / Pexels'})
});
function get(id){return Object.prototype.hasOwnProperty.call(photos,id)?photos[id]:null;}
root.FORME_FOOD_PHOTOS=Object.freeze({get});
})(typeof window!=='undefined'?window:globalThis);
