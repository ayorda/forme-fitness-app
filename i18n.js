/* Persist the selected interface language on this device. */
(function(root){
'use strict';
const storageKey='forme-language';
const languages=Object.freeze(['bg','en','de']);
const messages=Object.freeze({
 bg:Object.freeze({languageName:'Български',languageLabel:'Език',unavailable:'Съдържанието не е налично.',home:'Начало',workouts:'Тренировки',exercises:'Упражнения',nutrition:'Хранене',plan:'Моят план',favorites:'Любими',today:'Днес',startWorkout:'Започни тренировка',chooseWorkout:'Избери тренировка',viewPlan:'Виж седмичния план',noWorkout:'Няма планирана тренировка',restDay:'Почини си или избери занимание в седмичния си план.',search:'Търси',all:'Всички',level:'Ниво',equipment:'Оборудване',duration:'Продължителност',minutes:'мин',instructions:'Инструкции',demonstrationPending:'Демонстрацията предстои',imageUnavailable:'Изображението не е налично',pause:'Пауза',resume:'Продължи',next:'Следващо',restart:'Рестарт',close:'Затвори'}),
 en:Object.freeze({languageName:'English',languageLabel:'Language',unavailable:'Content is unavailable.',home:'Home',workouts:'Workouts',exercises:'Exercises',nutrition:'Nutrition',plan:'My plan',favorites:'Favorites',today:'Today',startWorkout:'Start workout',chooseWorkout:'Choose a workout',viewPlan:'View weekly plan',noWorkout:'No workout planned',restDay:'Rest or choose an activity in your weekly plan.',search:'Search',all:'All',level:'Level',equipment:'Equipment',duration:'Duration',minutes:'min',instructions:'Instructions',demonstrationPending:'Demonstration coming soon',imageUnavailable:'Image unavailable',pause:'Pause',resume:'Resume',next:'Next',restart:'Restart',close:'Close'}),
 de:Object.freeze({languageName:'Deutsch',languageLabel:'Sprache',unavailable:'Der Inhalt ist nicht verfügbar.',home:'Start',workouts:'Trainings',exercises:'Übungen',nutrition:'Ernährung',plan:'Mein Plan',favorites:'Favoriten',today:'Heute',startWorkout:'Training starten',chooseWorkout:'Training auswählen',viewPlan:'Wochenplan ansehen',noWorkout:'Kein Training geplant',restDay:'Erhole dich oder wähle eine Aktivität in deinem Wochenplan.',search:'Suchen',all:'Alle',level:'Level',equipment:'Ausrüstung',duration:'Dauer',minutes:'Min.',instructions:'Anleitung',demonstrationPending:'Demonstration folgt',imageUnavailable:'Bild nicht verfügbar',pause:'Pause',resume:'Fortsetzen',next:'Weiter',restart:'Neustart',close:'Schließen'})
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
