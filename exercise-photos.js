/* Supplemental still photography; it does not certify an exercise demonstration. */
(function(root){
'use strict';
const license='https://creativecommons.org/licenses/by-sa/4.0/';
const publicDomain='https://creativecommons.org/publicdomain/mark/1.0/';
const photos=Object.freeze({
 Pullups:Object.freeze({src:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Marian-Pull-Ups.jpg/500px-Marian-Pull-Ups.jpg',page:'https://commons.wikimedia.org/wiki/File:Marian-Pull-Ups.jpg',credit:'Abooyeah / Wikimedia Commons',license:'CC BY-SA 4.0',licenseUrl:license,changes:'Преоразмерена версия на оригинала.'}),
 Parallel_Bar_Dips:Object.freeze({src:'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/USS_Paul_Ignatius_%28DDG_117%29_Conducts_117_Fit_Club_Group_Exercise_%288430503%29.jpg/960px-USS_Paul_Ignatius_%28DDG_117%29_Conducts_117_Fit_Club_Group_Exercise_%288430503%29.jpg',page:'https://commons.wikimedia.org/wiki/File:USS_Paul_Ignatius_(DDG_117)_Conducts_117_Fit_Club_Group_Exercise_(8430503).jpg',credit:'Jahlena Riveraroyer / U.S. Navy',license:'Public domain (U.S.)',licenseUrl:publicDomain,changes:'Преоразмерена версия на оригинала.'}),
 Bench_Dips:Object.freeze({src:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/US_Navy_090212-N-2475A-005_Machinist%27s_Mate_2nd_Class_John_Brechwald%2C_from_San_Jose%2C_Calif.%2C_performs_bench_dips_with_two_45_lb_weights.jpg/960px-US_Navy_090212-N-2475A-005_Machinist%27s_Mate_2nd_Class_John_Brechwald%2C_from_San_Jose%2C_Calif.%2C_performs_bench_dips_with_two_45_lb_weights.jpg',page:'https://commons.wikimedia.org/wiki/File:US_Navy_090212-N-2475A-005_Machinist%27s_Mate_2nd_Class_John_Brechwald,_from_San_Jose,_Calif.,_performs_bench_dips_with_two_45_lb_weights.jpg',credit:'Kenneth Abbate / U.S. Navy',license:'Public domain (U.S.)',licenseUrl:publicDomain,changes:'Преоразмерена версия на оригинала.',note:'На снимката е показан вариант с допълнителна тежест.'}),
 Bar_Muscle_Up:Object.freeze({src:'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Muscle_Up.jpg/500px-Muscle_Up.jpg',page:'https://commons.wikimedia.org/wiki/File:Muscle_Up.jpg',credit:'Maksim Sokolov / Wikimedia Commons',license:'CC BY-SA 4.0',licenseUrl:license,changes:'Преоразмерена версия на оригинала.'})
});
root.FORME_EXERCISE_PHOTOS=Object.freeze({get(id){return Object.prototype.hasOwnProperty.call(photos,id)?photos[id]:null;}});
})(typeof window!=='undefined'?window:globalThis);
