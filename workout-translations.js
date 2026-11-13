/* English and German translations for all workouts in the FORME catalog. */
(function(root){
'use strict';
const en={
 'cal-start':['Strong Foundation','GET STARTED','Four foundational full-body movements.'],
 'cal-control':['Control and Strength','NEXT LEVEL','Bar work, stability and trunk control.'],
 'yoga-reset':['Calm Recovery','RECOVERY','A gentle practice for relaxation and breathing.'],
 'yoga-flow':['Deep Stretch','GENTLE MOVEMENT','A longer practice for flexibility.'],
 'mob-daily':['Move Freely','10 MINUTES','A quick mobility session without equipment.'],
 'mob-deep':['Joint Mobility','MOBILITY','Extra attention to hips, ankles and wrists.']
};
const de={
 'cal-start':['Starke Grundlage','EINSTIEG','Vier grundlegende Bewegungen für den ganzen Körper.'],
 'cal-control':['Kontrolle und Kraft','NÄCHSTES LEVEL','Stangenübungen, Stabilität und Rumpfkontrolle.'],
 'yoga-reset':['Ruhige Erholung','ERHOLUNG','Eine sanfte Praxis für Entspannung und Atmung.'],
 'yoga-flow':['Tiefe Dehnung','SANFTE BEWEGUNG','Eine längere Praxis für Beweglichkeit.'],
 'mob-daily':['Beweg dich frei','10 MINUTEN','Eine kurze Mobilitätseinheit ohne Geräte.'],
 'mob-deep':['Bewegliche Gelenke','MOBILITÄT','Mehr Aufmerksamkeit für Hüfte, Sprunggelenke und Handgelenke.']
};
function get(id,language){const r=language==='en'?en[id]:language==='de'?de[id]:null;return r?{name:r[0],tag:r[1],desc:r[2]}:null;}
root.FORME_WORKOUT_TRANSLATIONS=Object.freeze({get});
})(typeof window!=='undefined'?window:globalThis);
