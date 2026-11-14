/* Skill pathways describe preparation; journal evidence never certifies mastery. */
(function(root){
'use strict';
const trees=[
  {
    "id": "pull-ups",
    "title": [
      "Набирания с надхват",
      "Pull-Ups",
      "Klimmzüge im Obergriff"
    ],
    "targetExerciseId": "Pullups",
    "nodes": [
      {
        "id": "rows",
        "title": [
          "Хоризонтално дърпане",
          "Horizontal pulling",
          "Horizontales Ziehen"
        ],
        "exerciseId": "Australian_Rows",
        "requires": [],
        "criteria": [
          [
            "Поддържай стабилна линия на тялото и контролирай спускането.",
            "Keep a stable body line and control the lowering phase.",
            "Halte den Körper stabil und kontrolliere das Absenken."
          ],
          [
            "Избери височина на лоста, при която движението остава контролирано.",
            "Choose a bar height that allows controlled movement.",
            "Wähle eine Stangenhöhe, bei der du die Bewegung kontrollierst."
          ]
        ],
        "mode": "any",
        "kind": "reps"
      },
      {
        "id": "trunk",
        "title": [
          "Контрол на тялото",
          "Body control",
          "Körperkontrolle"
        ],
        "exerciseId": "Hollow_Body_Hold",
        "requires": [],
        "criteria": [
          [
            "Запази избраната позиция без задържане на дъха.",
            "Maintain your chosen position without holding your breath.",
            "Halte die gewählte Position, ohne die Luft anzuhalten."
          ],
          [
            "Използвай по-лесен вариант, ако губиш контрол на кръста.",
            "Use an easier variation if you lose control of your lower back.",
            "Nutze eine leichtere Variante, wenn die Kontrolle im unteren Rücken nachlässt."
          ]
        ],
        "mode": "any",
        "kind": "seconds"
      },
      {
        "id": "assisted",
        "title": [
          "Набиране с подходяща помощ",
          "Pulling with suitable assistance",
          "Ziehen mit passender Unterstützung"
        ],
        "exerciseId": "Pullups",
        "requires": [
          "rows",
          "trunk"
        ],
        "criteria": [
          [
            "Опиши действително използваната помощ: ластик, машина или партньор.",
            "Describe the assistance actually used: band, machine or partner.",
            "Beschreibe die tatsächlich genutzte Hilfe: Band, Maschine oder Partner."
          ],
          [
            "Движи се без засилване и спускай контролирано в комфортен обхват.",
            "Avoid swinging and lower with control through a comfortable range.",
            "Vermeide Schwung und senke dich kontrolliert im angenehmen Bewegungsumfang ab."
          ]
        ],
        "mode": "assisted",
        "kind": "reps"
      },
      {
        "id": "target",
        "title": [
          "Набиране без асистиране",
          "Unassisted pull",
          "Ziehen ohne Unterstützung"
        ],
        "exerciseId": "Pullups",
        "requires": [
          "rows",
          "trunk"
        ],
        "criteria": [
          [
            "Поддържай стабилен хват и контрол на раменете през движението.",
            "Maintain a stable grip and shoulder control throughout the movement.",
            "Halte den Griff stabil und kontrolliere die Schultern während der Bewegung."
          ],
          [
            "Оцени техниката и обхвата, а не само броя повторения.",
            "Assess technique and range, not only the repetition count.",
            "Beurteile Technik und Bewegungsumfang, nicht nur die Wiederholungszahl."
          ]
        ],
        "mode": "unassisted",
        "kind": "reps"
      }
    ],
    "nextGoalIds": [
      "muscle-up"
    ],
    "relatedExerciseIds": [
      "Tuck_Front_Lever"
    ]
  },
  {
    "id": "chin-ups",
    "title": [
      "Набирания с подхват",
      "Chin-Ups",
      "Klimmzüge im Untergriff"
    ],
    "targetExerciseId": "Chinups",
    "nodes": [
      {
        "id": "rows",
        "title": [
          "Хоризонтално дърпане",
          "Horizontal pulling",
          "Horizontales Ziehen"
        ],
        "exerciseId": "Australian_Rows",
        "requires": [],
        "criteria": [
          [
            "Поддържай стабилна линия на тялото и контролирай спускането.",
            "Keep a stable body line and control the lowering phase.",
            "Halte den Körper stabil und kontrolliere das Absenken."
          ],
          [
            "Избери височина на лоста, при която движението остава контролирано.",
            "Choose a bar height that allows controlled movement.",
            "Wähle eine Stangenhöhe, bei der du die Bewegung kontrollierst."
          ]
        ],
        "mode": "any",
        "kind": "reps"
      },
      {
        "id": "trunk",
        "title": [
          "Контрол на тялото",
          "Body control",
          "Körperkontrolle"
        ],
        "exerciseId": "Hollow_Body_Hold",
        "requires": [],
        "criteria": [
          [
            "Запази избраната позиция без задържане на дъха.",
            "Maintain your chosen position without holding your breath.",
            "Halte die gewählte Position, ohne die Luft anzuhalten."
          ],
          [
            "Използвай по-лесен вариант, ако губиш контрол на кръста.",
            "Use an easier variation if you lose control of your lower back.",
            "Nutze eine leichtere Variante, wenn die Kontrolle im unteren Rücken nachlässt."
          ]
        ],
        "mode": "any",
        "kind": "seconds"
      },
      {
        "id": "assisted",
        "title": [
          "Набиране с подходяща помощ",
          "Pulling with suitable assistance",
          "Ziehen mit passender Unterstützung"
        ],
        "exerciseId": "Chinups",
        "requires": [
          "rows",
          "trunk"
        ],
        "criteria": [
          [
            "Опиши действително използваната помощ: ластик, машина или партньор.",
            "Describe the assistance actually used: band, machine or partner.",
            "Beschreibe die tatsächlich genutzte Hilfe: Band, Maschine oder Partner."
          ],
          [
            "Движи се без засилване и спускай контролирано в комфортен обхват.",
            "Avoid swinging and lower with control through a comfortable range.",
            "Vermeide Schwung und senke dich kontrolliert im angenehmen Bewegungsumfang ab."
          ]
        ],
        "mode": "assisted",
        "kind": "reps"
      },
      {
        "id": "target",
        "title": [
          "Набиране без асистиране",
          "Unassisted pull",
          "Ziehen ohne Unterstützung"
        ],
        "exerciseId": "Chinups",
        "requires": [
          "rows",
          "trunk"
        ],
        "criteria": [
          [
            "Поддържай стабилен хват и контрол на раменете през движението.",
            "Maintain a stable grip and shoulder control throughout the movement.",
            "Halte den Griff stabil und kontrolliere die Schultern während der Bewegung."
          ],
          [
            "Оцени техниката и обхвата, а не само броя повторения.",
            "Assess technique and range, not only the repetition count.",
            "Beurteile Technik und Bewegungsumfang, nicht nur die Wiederholungszahl."
          ]
        ],
        "mode": "unassisted",
        "kind": "reps"
      }
    ],
    "nextGoalIds": [
      "muscle-up"
    ],
    "relatedExerciseIds": [
      "Tuck_Front_Lever"
    ]
  },
  {
    "id": "dips",
    "title": [
      "Кофички",
      "Dips",
      "Dips"
    ],
    "targetExerciseId": "Parallel_Bar_Dips",
    "nodes": [
      {
        "id": "support",
        "title": [
          "Стабилна опора",
          "Stable support",
          "Stabiler Stütz"
        ],
        "exerciseId": "Plank",
        "requires": [],
        "criteria": [
          [
            "Поддържай стабилен корпус и комфортна позиция на раменете.",
            "Maintain a stable trunk and a comfortable shoulder position.",
            "Halte den Rumpf stabil und die Schultern in einer angenehmen Position."
          ],
          [
            "Дишай спокойно; намали трудността при загуба на позиция.",
            "Breathe steadily; reduce difficulty if your position breaks down.",
            "Atme ruhig und reduziere die Schwierigkeit, wenn die Position nachlässt."
          ]
        ],
        "mode": "any",
        "kind": "seconds"
      },
      {
        "id": "push",
        "title": [
          "Контрол в избутването",
          "Pushing control",
          "Kontrolle beim Drücken"
        ],
        "exerciseId": "Pushups",
        "requires": [],
        "criteria": [
          [
            "Поддържай контрол при спускане и избутване.",
            "Maintain control while lowering and pushing.",
            "Kontrolliere sowohl das Absenken als auch das Hochdrücken."
          ],
          [
            "Използвай вариант, който позволява стабилни рамене и лакти.",
            "Choose a variation that allows stable shoulders and elbows.",
            "Wähle eine Variante, bei der Schultern und Ellbogen stabil bleiben."
          ]
        ],
        "mode": "any",
        "kind": "reps"
      },
      {
        "id": "assisted",
        "title": [
          "Кофички с асистиране",
          "Assisted dips",
          "Dips mit Unterstützung"
        ],
        "exerciseId": "Parallel_Bar_Dips",
        "requires": [
          "support",
          "push"
        ],
        "criteria": [
          [
            "Използвай стабилна успоредка и опиши помощта в дневника.",
            "Use stable parallel bars and describe assistance in your journal.",
            "Nutze stabile Parallelbarren und beschreibe die Hilfe im Tagebuch."
          ],
          [
            "Ограничи дълбочината до контролирания, безболезнен обхват.",
            "Limit depth to a controlled, pain-free range.",
            "Begrenze die Tiefe auf einen kontrollierten, schmerzfreien Bereich."
          ]
        ],
        "mode": "assisted",
        "kind": "reps"
      },
      {
        "id": "target",
        "title": [
          "Кофички без асистиране",
          "Unassisted dips",
          "Dips ohne Unterstützung"
        ],
        "exerciseId": "Parallel_Bar_Dips",
        "requires": [
          "support",
          "push"
        ],
        "criteria": [
          [
            "Задръж стабилно горното положение и контролирай цялото движение.",
            "Keep the top position stable and control the entire movement.",
            "Halte die obere Position stabil und kontrolliere die gesamte Bewegung."
          ],
          [
            "Не търси допълнителна дълбочина за сметка на раменете.",
            "Do not chase extra depth at the expense of your shoulders.",
            "Erzwinge keine zusätzliche Tiefe auf Kosten deiner Schultern."
          ]
        ],
        "mode": "unassisted",
        "kind": "reps"
      }
    ],
    "nextGoalIds": [
      "muscle-up"
    ],
    "relatedExerciseIds": [
      "L_Sit"
    ]
  },
  {
    "id": "muscle-up",
    "title": [
      "Силово възлизане",
      "Muscle-Up",
      "Muscle-Up"
    ],
    "targetExerciseId": "Bar_Muscle_Up",
    "nodes": [
      {
        "id": "pull",
        "title": [
          "База в дърпането",
          "Pulling foundation",
          "Grundlage im Ziehen"
        ],
        "exerciseId": "Pullups",
        "requires": [],
        "criteria": [
          [
            "Развивай контролирано набиране без засилване.",
            "Develop controlled pull-ups without swinging.",
            "Entwickle kontrollierte Klimmzüge ohne Schwung."
          ],
          [
            "Работата по високо дърпане изисква отделна оценка на техниката.",
            "High-pull practice needs a separate technique assessment.",
            "Hohe Züge erfordern eine gesonderte Beurteilung der Technik."
          ]
        ],
        "mode": "unassisted",
        "kind": "reps"
      },
      {
        "id": "push",
        "title": [
          "База в избутването",
          "Pushing foundation",
          "Grundlage im Drücken"
        ],
        "exerciseId": "Parallel_Bar_Dips",
        "requires": [],
        "criteria": [
          [
            "Успоредката развива база, но опората и избутването на лост са различни.",
            "Parallel bars build a foundation, but support and pressing on a straight bar differ.",
            "Parallelbarren schaffen eine Grundlage; Stütz und Drücken an einer geraden Stange unterscheiden sich jedoch."
          ],
          [
            "Усвои специфичната опора на лост и прехода с подходящо оборудване и треньор.",
            "Learn bar-specific support and transition with suitable equipment and a coach.",
            "Lerne den stangenspezifischen Stütz und Übergang mit geeigneter Ausrüstung und einem Trainer."
          ]
        ],
        "mode": "unassisted",
        "kind": "reps"
      },
      {
        "id": "trunk",
        "title": [
          "Контрол на тялото",
          "Body control",
          "Körperkontrolle"
        ],
        "exerciseId": "Hollow_Body_Hold",
        "requires": [],
        "criteria": [
          [
            "Запази избраната позиция без задържане на дъха.",
            "Maintain your chosen position without holding your breath.",
            "Halte die gewählte Position, ohne die Luft anzuhalten."
          ],
          [
            "Използвай по-лесен вариант, ако губиш контрол на кръста.",
            "Use an easier variation if you lose control of your lower back.",
            "Nutze eine leichtere Variante, wenn die Kontrolle im unteren Rücken nachlässt."
          ]
        ],
        "mode": "any",
        "kind": "seconds"
      },
      {
        "id": "transition",
        "title": [
          "Преход с асистиране",
          "Assisted transition",
          "Übergang mit Unterstützung"
        ],
        "exerciseId": "Bar_Muscle_Up",
        "requires": [
          "pull",
          "push",
          "trunk"
        ],
        "criteria": [
          [
            "Упражнявай прехода отделно с квалифициран треньор.",
            "Practise the transition separately with a qualified coach.",
            "Übe den Übergang gesondert mit einem qualifizierten Trainer."
          ],
          [
            "Използвай подходяща ниска опора или помощ и я опиши точно.",
            "Use suitable low support or assistance and describe it precisely.",
            "Nutze eine geeignete niedrige Stange oder Unterstützung und beschreibe sie genau."
          ]
        ],
        "mode": "assisted",
        "kind": "reps"
      },
      {
        "id": "target",
        "title": [
          "Цялостно възлизане",
          "Complete muscle-up",
          "Vollständiger Muscle-Up"
        ],
        "exerciseId": "Bar_Muscle_Up",
        "requires": [
          "pull",
          "push",
          "trunk"
        ],
        "criteria": [
          [
            "Свържи дърпане, преход и избутване само след подготовка на всяка част.",
            "Combine pulling, transition and pressing only after preparing each part.",
            "Verbinde Ziehen, Übergang und Drücken erst nach Vorbereitung jedes Teils."
          ],
          [
            "Записаните повторения не потвърждават безопасен преход; нужна е оценка на техниката.",
            "Logged repetitions do not confirm a safe transition; technique assessment is needed.",
            "Erfasste Wiederholungen bestätigen keinen sicheren Übergang; eine Technikbeurteilung ist erforderlich."
          ]
        ],
        "mode": "unassisted",
        "kind": "reps"
      }
    ],
    "nextGoalIds": [],
    "relatedExerciseIds": [
      "Ring_Muscle_Up"
    ]
  },
  {
    "id": "handstand",
    "title": [
      "Стойка на ръце",
      "Handstand",
      "Handstand"
    ],
    "targetExerciseId": "Handstand",
    "nodes": [
      {
        "id": "wrists",
        "title": [
          "Подготовка на китките",
          "Wrist preparation",
          "Vorbereitung der Handgelenke"
        ],
        "exerciseId": "Kneeling_Forearm_Stretch",
        "requires": [],
        "criteria": [
          [
            "Подготви китките постепенно, без натиск до болка или изтръпване.",
            "Prepare the wrists gradually without forcing pain or numbness.",
            "Bereite die Handgelenke schrittweise vor, ohne Schmerz oder Taubheit zu erzwingen."
          ],
          [
            "Разтягането е част от подготовката и не доказва готовност за пълно натоварване.",
            "Stretching is part of preparation and does not prove readiness for full loading.",
            "Dehnen ist ein Teil der Vorbereitung und belegt keine Bereitschaft für volle Belastung."
          ]
        ],
        "mode": "any",
        "kind": "seconds"
      },
      {
        "id": "trunk",
        "title": [
          "Контрол на тялото",
          "Body control",
          "Körperkontrolle"
        ],
        "exerciseId": "Hollow_Body_Hold",
        "requires": [],
        "criteria": [
          [
            "Запази избраната позиция без задържане на дъха.",
            "Maintain your chosen position without holding your breath.",
            "Halte die gewählte Position, ohne die Luft anzuhalten."
          ],
          [
            "Използвай по-лесен вариант, ако губиш контрол на кръста.",
            "Use an easier variation if you lose control of your lower back.",
            "Nutze eine leichtere Variante, wenn die Kontrolle im unteren Rücken nachlässt."
          ]
        ],
        "mode": "any",
        "kind": "seconds"
      },
      {
        "id": "push",
        "title": [
          "Избутване над главата",
          "Overhead pushing",
          "Drücken über Kopf"
        ],
        "exerciseId": "Pike_Pushups",
        "requires": [
          "wrists",
          "trunk"
        ],
        "criteria": [
          [
            "Използвай стабилна опора и контролирано избутване.",
            "Use stable support and a controlled push.",
            "Nutze einen stabilen Stütz und kontrolliertes Drücken."
          ],
          [
            "Избери трудност, при която поддържаш контрол на раменете и корпуса.",
            "Choose a difficulty that preserves shoulder and trunk control.",
            "Wähle eine Schwierigkeit, bei der Schultern und Rumpf kontrolliert bleiben."
          ]
        ],
        "mode": "any",
        "kind": "reps"
      },
      {
        "id": "target",
        "title": [
          "Стойка с подходяща опора",
          "Handstand with suitable support",
          "Handstand mit geeignetem Stütz"
        ],
        "exerciseId": "Handstand",
        "requires": [
          "wrists",
          "trunk",
          "push"
        ],
        "criteria": [
          [
            "Първо усвои стабилната опора и безопасен изход с помощта на треньор.",
            "First learn stable support and a safe exit with a coach.",
            "Lerne zuerst einen stabilen Stütz und einen sicheren Ausstieg mit einem Trainer."
          ],
          [
            "Каталогът използва стена. Записът сам по себе си не доказва баланс без опора.",
            "The catalog uses a wall. A log alone does not demonstrate freestanding balance.",
            "Der Katalog nutzt eine Wand. Ein Eintrag allein belegt keinen freien Handstand."
          ]
        ],
        "mode": "any",
        "kind": "seconds"
      }
    ],
    "nextGoalIds": [],
    "relatedExerciseIds": [
      "Handstand_Pushups"
    ]
  }
];
const languageIndex=language=>({bg:0,en:1,de:2}[language]??0);
function localized(language='bg'){
 const index=languageIndex(language),text=value=>value[index];
 return trees.map(tree=>({...tree,title:text(tree.title),nextGoalIds:[...tree.nextGoalIds],relatedExerciseIds:[...tree.relatedExerciseIds],nodes:tree.nodes.map(node=>({...node,title:text(node.title),requires:[...node.requires],criteria:node.criteria.map(text),nextIds:tree.nodes.filter(item=>item.requires.includes(node.id)).map(item=>item.id)}))}));
}
function validRecord(record){
 if(!record||typeof record!=='object'||!Number.isInteger(record.value)||record.value<1||record.value>3600||!['reps','seconds'].includes(record.kind)||typeof record.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(record.date))return false;
 const date=new Date(record.date+'T12:00:00');
 return !Number.isNaN(date.getTime())&&`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`===record.date&&(record.weightKg===undefined||(typeof record.weightKg==='number'&&Number.isFinite(record.weightKg)&&record.weightKg>=0&&record.weightKg<=500&&Math.abs(record.weightKg*100-Math.round(record.weightKg*100))<1e-6))&&(record.assistance===undefined||(typeof record.assistance==='string'&&record.assistance.length<=120));
}
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function evidence(node,sets=[],at=dateKey(new Date())){
 const cutoff=typeof at==='string'?at:null;
 const all=(Array.isArray(sets)?sets:[]).filter(record=>validRecord(record)&&record.exerciseId===node.exerciseId&&(!cutoff||record.date<=cutoff));
 const matching=all.filter(record=>{
  if(node.kind&&record.kind!==node.kind)return false;
  const assisted=!!String(record.assistance||'').trim();
  return node.mode==='assisted'?assisted:node.mode==='unassisted'?!assisted&&!(record.weightKg>0):true;
 }).reverse().sort((a,b)=>b.date.localeCompare(a.date));
 return {recordCount:matching.length,latest:matching[0]?{...matching[0]}:null,otherConditions:all.length-matching.length};
}
function pathway(id,sets=[],language='bg',at){
 const tree=localized(language).find(item=>item.id===id);if(!tree)return null;
 return {...tree,nodes:tree.nodes.map(node=>({...node,evidence:evidence(node,sets,at)}))};
}
root.FORME_SKILL_TREES=Object.freeze({localized,pathway,evidence});
})(typeof window!=='undefined'?window:globalThis);
