/* Four-week plans assembled only from the existing, reviewed workout IDs. */
(function(root){
'use strict';
const programs=Object.freeze([
 Object.freeze({id:'foundation',level:'beginner',weeks:[['cal-start','yoga-reset','mob-daily'],['cal-start','mob-daily','yoga-reset'],['cal-start','yoga-reset','mob-daily'],['cal-start','mob-daily','yoga-reset']]}),
 Object.freeze({id:'strength',level:'intermediate',weeks:[['cal-control','mob-daily','cal-start'],['cal-control','cal-start','mob-daily'],['cal-control','mob-daily','cal-start'],['cal-control','cal-start','mob-daily']]}),
 Object.freeze({id:'mobility',level:'intermediate',weeks:[['mob-daily','yoga-reset','mob-deep'],['mob-daily','yoga-flow','mob-deep'],['mob-daily','yoga-reset','mob-deep'],['mob-daily','yoga-flow','mob-deep']]})
]);
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function schedule(id,from=new Date()){
 const program=programs.find(x=>x.id===id);if(!program)return [];
 const monday=new Date(from.getFullYear(),from.getMonth(),from.getDate());monday.setDate(monday.getDate()+(8-monday.getDay())%7);
 return program.weeks.flatMap((week,weekIndex)=>week.map((workoutId,slot)=>{const date=new Date(monday);date.setDate(date.getDate()+weekIndex*7+[0,2,4][slot]);return {date:dateKey(date),workoutId};}));
}
root.FORME_PROGRAMS=Object.freeze({programs,schedule});
})(typeof window!=='undefined'?window:globalThis);
