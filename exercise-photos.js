/* One local AI visualization per exercise. Visuals support instructions, not technique certification. */
(function(root){
'use strict';
const ids=["Pushups","Bodyweight_Squat","Plank","Pullups","Mountain_Climbers","Bench_Dips","Hanging_Leg_Raise","Side_Bridge","Childs_Pose","Cat_Stretch","Butt_Lift_Bridge","Dancers_Stretch","Seated_Floor_Hamstring_Stretch","Groin_and_Back_Stretch","Spinal_Stretch","Seated_Overhead_Stretch","Standing_Hip_Circles","Hip_Circles_prone","Arm_Circles","Kneeling_Hip_Flexor","Dynamic_Chest_Stretch","Shoulder_Stretch","Calf_Stretch_Hands_Against_Wall","Kneeling_Forearm_Stretch","Chinups","Australian_Rows","Parallel_Bar_Dips","Bar_Muscle_Up","Hollow_Body_Hold","Frog_Stand","Pike_Pushups","Skin_the_Cat","Toes_to_Bar","Archer_Pushups","Pistol_Squat","L_Sit","Dragon_Flag","Handstand","Tuck_Planche","Tuck_Front_Lever","Ring_Muscle_Up","Back_Lever","Human_Flag","Handstand_Pushups","Front_Lever","Straddle_Planche","Full_Planche","One_Arm_Pull_Up","Iron_Cross"];
// Only individually reviewed, immutable replacements use a revised filename.
const revisions=Object.freeze({"Skin_the_Cat": "anatomy-v2", "Handstand": "anatomy-v3", "Handstand_Pushups": "anatomy-v3", "Tuck_Front_Lever": "anatomy-v3", "Toes_to_Bar": "anatomy-v3", "Archer_Pushups": "anatomy-v3", "Seated_Overhead_Stretch": "anatomy-v3", "Hip_Circles_prone": "anatomy-v3", "Tuck_Planche": "anatomy-v3", "Straddle_Planche": "anatomy-v3", "Full_Planche": "anatomy-v3", "Kneeling_Forearm_Stretch": "anatomy-v3"});
const photos=Object.freeze(Object.fromEntries(ids.map(id=>[id,Object.freeze({
 origin:'ai',generator:'OpenAI image generation tool',created:Boolean(revisions[id])?'2026-11-17':'2026-11-07',
 small:`media/exercises/${id}${revisions[id]?'-'+revisions[id]:''}-480.webp`,large:`media/exercises/${id}${revisions[id]?'-'+revisions[id]:''}-960.webp`
})])));
root.FORME_EXERCISE_PHOTOS=Object.freeze({get(id){return Object.prototype.hasOwnProperty.call(photos,id)?photos[id]:null;},ids});
})(typeof window!=='undefined'?window:globalThis);
