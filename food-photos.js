/* Selected Pexels photos; labels describe reference foods, not a weighed serving. */
(function(root){
'use strict';
const photos=Object.freeze({
 rice:Object.freeze({src:'https://images.pexels.com/photos/17563535/pexels-photo-17563535/free-photo-of-rice.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/rice-17563535/',credit:'Jubair Bin Iqbal / Pexels'}),
 chicken:Object.freeze({src:'https://images.pexels.com/photos/6107734/pexels-photo-6107734.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/close-up-photo-of-a-raw-chicken-meat-6107734/',credit:'alleksana / Pexels'}),
 banana:Object.freeze({src:'https://images.pexels.com/photos/4451847/pexels-photo-4451847.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/a-peeled-banana-on-the-table-4451847/',credit:'alleksana / Pexels'}),
 broccoli:Object.freeze({src:'https://images.pexels.com/photos/7890027/pexels-photo-7890027.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/photo-of-a-green-broccoli-7890027/',credit:'MART PRODUCTION / Pexels'}),
 egg:Object.freeze({src:'https://images.pexels.com/photos/6294255/pexels-photo-6294255.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/uncooked-broken-eggs-in-bowl-placed-on-wicker-table-mat-6294255/',credit:'Klaus Nielsen / Pexels'}),
 almonds:Object.freeze({src:'https://images.pexels.com/photos/4753649/pexels-photo-4753649.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/brown-almond-nuts-on-white-ceramic-bowl-4753649/',credit:'Antoni Shkraba / Pexels'}),
 avocado:Object.freeze({src:'https://images.pexels.com/photos/1759055/pexels-photo-1759055.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/selective-focus-photography-of-sliced-avocado-1759055/',credit:'Lisa Fotios / Pexels'}),
 oats:Object.freeze({src:'https://images.pexels.com/photos/7655896/pexels-photo-7655896.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/oat-flakes-on-a-wooden-spoon-7655896/',credit:'Cup of Couple / Pexels'}),
 tomato:Object.freeze({src:'https://images.pexels.com/photos/38444066/pexels-photo-38444066/free-photo-of-fresh-red-tomatoes-on-white-background.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/fresh-red-tomatoes-on-white-background-38444066/',credit:'mackling / Pexels'}),
 cucumber:Object.freeze({src:'https://images.pexels.com/photos/8755152/pexels-photo-8755152.jpeg?auto=compress&w=1260&h=750&dpr=1',page:'https://www.pexels.com/photo/sliced-cucumber-on-white-table-8755152/',credit:'Tamanna Rumee / Pexels'})
});
function get(id){return Object.prototype.hasOwnProperty.call(photos,id)?photos[id]:null;}
root.FORME_FOOD_PHOTOS=Object.freeze({get});
})(typeof window!=='undefined'?window:globalThis);
