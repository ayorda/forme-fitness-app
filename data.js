/* FORME: curated Bulgarian content. Exercise photos: yuhonas/free-exercise-db (Unlicense).
   Food values: indicative USDA FoodData Central reference figures per 100g; see README for audit status. */
(function(){
const E=(id,name,cat,level,equip,description,steps,easier)=>({id,name,cat,level,equip,description,steps,easier,photo:`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${id}/0.jpg`,photo2:`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${id}/1.jpg`,source:`https://github.com/yuhonas/free-exercise-db/blob/main/exercises/${id}.json`});
const exercises=[
E('Pushups','Лицеви опори','cal','beginner','none','Сила за гърди, рамене и трицепс.','Постави длани малко по-широко от раменете. Дръж тялото стегнато. Спусни гърдите контролирано и избутай нагоре.','Лицеви опори с колене на земята.'),
E('Bodyweight_Squat','Клек със собствено тегло','cal','beginner','none','Основно движение за крака и седалище.','Стъпи на ширината на раменете. Изнеси таза назад и сгъни коленете. Изправи се, като натискаш пода с цялото стъпало.','Клек до стол.'),
E('Plank','Планк','cal','beginner','none','Статично укрепване на корем и торс.','Подпрете се на предмишници и пръсти. Стегни корема и седалището. Дишай спокойно, без да отпускаш кръста.','Планк с колене на пода.'),
E('Pullups','Набирания','cal','intermediate','bar','Сила на гръб и ръце.','Хвани лоста стабилно. Издърпай тялото нагоре без рязко люлеене. Спусни се контролирано до почти изпънати ръце.','Набирания с ластик или негативни повторения.'),
E('Mountain_Climbers','Планински катерач','cal','beginner','none','Динамично натоварване на торса и пулса.','Застани в позиция за лицева опора. Придърпай едно коляно към гърдите. Редувай краката с контролирано темпо.','Бавно редуване на коленете.'),
E('Bench_Dips','Кофички на пейка','cal','intermediate','bench','Упражнение за трицепс с опора.','Подпри ръцете на стабилна пейка зад теб. Сгъни лактите умерено, без да проваляш раменете. Избутай се нагоре.','Сгъни коленете и намали амплитудата.'),
E('Hanging_Leg_Raise','Повдигане на крака от вис','cal','advanced','bar','Контрол на корема и таза от вис.','Увисни стабилно на лоста. Повдигни краката контролирано, без люлеене. Върни ги бавно.','Повдигане на колене от вис.'),
E('Side_Bridge','Страничен планк','cal','beginner','none','Стабилност на страничната коремна мускулатура.','Подпри се на една предмишница. Подравни рамо, таз и глезени. Задръж, без тазът да пропада.','Свий долното коляно и го остави на пода.'),
E('Childs_Pose','Поза на детето','yoga','beginner','mat','Спокойна поза за отпускане на гърба.','Застани на колене. Седни назад към петите и протегни ръцете напред. Дишай плавно.','Разтвори коленете и постави възглавница под торса.'),
E('Cat_Stretch','Котешки гръб','yoga','beginner','mat','Мека мобилизация на гръбнака.','Застани на длани и колене. Издишай и закръгли гърба. Върни се плавно до неутрална позиция.','По-малка амплитуда.'),
E('Butt_Lift_Bridge','Мост от лег','yoga','beginner','mat','Отваряне на предната линия и активиране на седалището.','Легни по гръб със свити колене. Повдигни таза чрез натиск през петите. Спусни бавно.','Повдигай таза по-ниско.'),
E('Dancers_Stretch','Седящо усукване','yoga','beginner','mat','Леко разтягане и усукване в седеж.','Седни с изпънат единия крак. Прехвърли другия през него и завърти торса внимателно. Смени страната.','Остави двата крака по-отпуснати.'),
E('Seated_Floor_Hamstring_Stretch','Наклон напред в седеж','yoga','beginner','mat','Разтягане на задната част на бедрата.','Седни с единия крак изпънат. Наклони се от таза към изпънатия крак, без да дърпаш рязко. Смени страната.','Свий леко коляното.'),
E('Groin_and_Back_Stretch','Пеперуда в седеж','yoga','intermediate','mat','Отпускане на вътрешните бедра.','Седни и събери ходилата. Отпусни коленете настрани. Наклони се леко напред, без натиск.','Постави опора под коленете.'),
E('Spinal_Stretch','Разтягане на гръбнака в седеж','yoga','beginner','chair','Нежна практика за гръб и рамене.','Седни стабилно на стол. Постави длани зад главата. Наведи леко брадичката и отпусни гърба без болка.','По-малка амплитуда.'),
E('Seated_Overhead_Stretch','Странично разтягане в седеж','yoga','beginner','mat','Плавно странично разтягане за торс и рамене.','Седни със събрани ходила. Подпри едната длан отстрани, постави другата ръка над главата и наклони торса плавно настрани. Смени страната.','Намали страничния наклон.'),
E('Standing_Hip_Circles','Кръгове с тазобедрена става','mobility','beginner','none','Активна мобилност на таза.','Застани на един крак с опора при нужда. Повдигни коляно и очертай бавен кръг. Смени посоката и крака.','По-малки кръгове.'),
E('Hip_Circles_prone','Кръгове с коляно от четири опори','mobility','beginner','mat','Контролирано движение на тазобедрената става.','Застани на четири опори. Повдигни едно свито коляно. Направи плавен кръг, без да извиваш кръста.','Намали радиуса на кръга.'),
E('Arm_Circles','Кръгове с ръце','mobility','beginner','none','Загряване на раменния пояс.','Изпъни ръце встрани. Прави малки кръгове напред и назад. Увеличавай размера постепенно.','Започни с много малки кръгове.'),
E('Kneeling_Hip_Flexor','Разтягане на сгъвачите на таза','mobility','beginner','mat','Раздвижване на предната част на таза.','Застани на едно коляно. Прибери таза леко и премести тежестта напред. Смени страната.','Постави мека опора под коляното.'),
E('Dynamic_Chest_Stretch','Динамично отваряне на гърди','mobility','beginner','none','Подвижност на гърди и рамене.','Изпъни ръце пред тялото. Отвори ги встрани контролирано. Върни и повтори, без да засилваш.','По-малка амплитуда.'),
E('Shoulder_Stretch','Разтягане на рамо','mobility','beginner','none','Леко разтягане на задното рамо.','Прехвърли едната ръка пред гърдите. Придържай я внимателно с другата. Смени страната.','Намали натиска.'),
E('Calf_Stretch_Hands_Against_Wall','Разтягане на прасец до стена','mobility','beginner','wall','Подвижност на глезена и прасеца.','Постави длани на стена. Изнеси единия крак назад с пета на земята. Наклони се напред и смени крака.','Приближи задния крак.'),
E('Kneeling_Forearm_Stretch','Разтягане на китки','mobility','beginner','mat','Подготовка на китките за опори и стойки.','Застани на колене и постави длани на пода с пръсти към коленете. Премести тежестта леко назад. Не допускай болка.','Изпълни с по-малко натоварване.'),
];
const workouts=[
{id:'cal-start',name:'Силна основа',cat:'cal',level:'beginner',duration:12,rounds:3,workSec:40,restSec:20,equip:'none',ids:['Bodyweight_Squat','Pushups','Plank','Mountain_Climbers'],tag:'НАЧАЛО',desc:'Четири основни движения за цялото тяло.'},
{id:'cal-control',name:'Контрол и сила',cat:'cal',level:'intermediate',duration:18,rounds:4,workSec:50,restSec:20,equip:'bar',ids:['Pullups','Hanging_Leg_Raise','Pushups','Side_Bridge'],tag:'СЛЕДВАЩО НИВО',desc:'Лост, стабилност и контрол на торса.'},
{id:'yoga-reset',name:'Спокойно възстановяване',cat:'yoga',level:'beginner',duration:12,rounds:3,workSec:40,restSec:20,equip:'mat',ids:['Childs_Pose','Cat_Stretch','Butt_Lift_Bridge','Seated_Overhead_Stretch'],tag:'ВЪЗСТАНОВЯВАНЕ',desc:'Плавна практика за отпускане и дишане.'},
{id:'yoga-flow',name:'Дълбоко разтягане',cat:'yoga',level:'intermediate',duration:20,rounds:4,workSec:55,restSec:20,equip:'mat',ids:['Dancers_Stretch','Groin_and_Back_Stretch','Seated_Floor_Hamstring_Stretch','Childs_Pose'],tag:'ПЛАВНО ДВИЖЕНИЕ',desc:'По-дълга практика за гъвкавост.'},
{id:'mob-daily',name:'Движи се свободно',cat:'mobility',level:'beginner',duration:10,rounds:3,workSec:30,restSec:20,equip:'none',ids:['Arm_Circles','Dynamic_Chest_Stretch','Shoulder_Stretch','Standing_Hip_Circles'],tag:'10 МИНУТИ',desc:'Бързо раздвижване без оборудване.'},
{id:'mob-deep',name:'Свободни стави',cat:'mobility',level:'intermediate',duration:16,rounds:4,workSec:40,restSec:20,equip:'mat',ids:['Hip_Circles_prone','Kneeling_Hip_Flexor','Calf_Stretch_Hands_Against_Wall','Kneeling_Forearm_Stretch'],tag:'МОБИЛНОСТ',desc:'Таз, глезени и китки с повече внимание.'},
];
// food: id, Bulgarian name, category, state, kcal, protein, carbs, fat, fiber, emoji, info, USDA FDC id if checked
// Search terms in English so each non-ID link resolves to the intended USDA record type.
const usdaTerms={chicken:'chicken breast skinless boneless raw',turkey:'turkey breast meat only raw',egg:'egg whole raw fresh',tuna:'tuna light canned water drained',salmon:'salmon Atlantic farmed raw',greek:'yogurt Greek plain lowfat',cottage:'cottage cheese lowfat 2%',oats:'cereals oats regular quick dry',rice:'rice white long grain enriched cooked',brownrice:'rice brown long grain cooked',quinoa:'quinoa cooked',bread:'bread whole wheat commercially prepared',potato:'potatoes flesh and skin raw',lentils:'lentils mature seeds cooked boiled',avocado:'avocados raw California',almonds:'nuts almonds raw',walnuts:'nuts walnuts english',oliveoil:'oil olive salad or cooking',peanutbutter:'peanut butter smooth without salt',chocolate:'chocolate dark 70-85 cacao',banana:'bananas raw',apple:'apples raw golden delicious with skin',orange:'oranges raw navels',blueberry:'blueberries raw',strawberry:'strawberries raw',broccoli:'broccoli raw',spinach:'spinach raw',carrot:'carrots raw',tomato:'tomatoes red ripe raw',cucumber:'cucumber with peel raw'};
const verifiedFdcIds={"chicken": 171077, "turkey": 171098, "egg": 171287, "tuna": 171986, "salmon": 175167, "greek": 170903, "cottage": 172182, "oats": 173904, "rice": 168878, "brownrice": 169704, "quinoa": 168917, "bread": 172688, "potato": 170026, "lentils": 172421, "avocado": 171705, "almonds": 170567, "walnuts": 170187, "oliveoil": 171413, "peanutbutter": 172470, "chocolate": 170273, "banana": 173944, "apple": 168202, "orange": 169097, "blueberry": 171711, "strawberry": 167762, "broccoli": 170379, "spinach": 168462, "carrot": 170393, "tomato": 170457, "cucumber": 168409};
const F=(id,name,cat,state,kcal,protein,carbs,fat,fiber,emoji,info,fdcId)=>{const sourceId=fdcId||verifiedFdcIds[id];return {id,name,cat,state,kcal,protein,carbs,fat,fiber,emoji,info,fdcId:sourceId,source:`https://fdc.nal.usda.gov/food-search/?query=${sourceId}`,sourceDetails:`https://nutri-db.com/en/foods/${sourceId}`};};
const foods=[
F('chicken','Пилешки гърди','protein','сурови, без кожа',120,22.5,0,2.62,0,'🍗','Богат източник на протеин.',171077),
F('turkey','Пуешки гърди','protein','сурови, чисто месо',114,23.7,0.14,1.48,0,'🍖','Постен протеин за разнообразно меню.'),
F('egg','Яйце','protein','цяло, сурово',143,12.56,0.72,9.51,0,'🥚','Съдържа протеин и мазнини.',171287),
F('tuna','Риба тон','protein','консерва във вода, без сол, отцедена',116,25.5,0,0.8,0,'🐟','Удобен протеинов продукт.'),
F('salmon','Сьомга','protein','сурова, атлантическа',208,20.4,0,13.4,0,'🐟','Осигурява протеин и мазнини.'),
F('greek','Гръцко кисело мляко','protein','нискомаслено, натурално',73,9.95,3.94,1.92,0,'🥛','Подходящо за бърза закуска.'),
F('cottage','Извара','protein','нискомаслена, около 2%',81,10.45,4.76,2.27,0,'🧀','Протеин с различни приложения.'),
F('oats','Овесени ядки','carbs','сухи, без обогатяване',379,13.15,67.7,6.52,10.1,'🌾','Богати на въглехидрати и фибри.',173904),
F('rice','Бял ориз','carbs','сварен, обогатен',130,2.69,28.17,0.28,0.4,'🍚','Лесен за комбиниране източник на въглехидрати.',168878),
F('brownrice','Кафяв ориз','carbs','сварен',123,2.74,25.58,0.97,1.6,'🍚','Пълнозърнеста алтернатива.'),
F('quinoa','Киноа','carbs','сварена',120,4.4,21.3,1.92,2.8,'🥣','Съдържа въглехидрати, протеин и фибри.'),
F('bread','Пълнозърнест хляб','carbs','готов, търговски приготвен',252,12.45,42.71,3.5,6,'🍞','Практичен източник на енергия.'),
F('potato','Картофи','carbs','сурови, с кора',77,2.05,17.5,0.09,2.1,'🥔','Източник на нишесте и калий.'),
F('lentils','Леща','carbs','сварена, без сол',116,9.02,20.13,0.38,7.9,'🫘','Фибри и растителен протеин.'),
F('avocado','Авокадо','fats','сурово',160,2,8.53,14.66,6.7,'🥑','Източник на ненаситени мазнини.'),
F('almonds','Бадеми','fats','сурови',579,21.15,21.55,49.93,12.5,'🥜','Мазнини, протеин и фибри.'),
F('walnuts','Орехи','fats','сурови',654,15.23,13.71,65.21,6.7,'🌰','Енергийно плътна ядка.'),
F('oliveoil','Зехтин','fats','чист, без добавки',884,0,0,100,0,'🫒','Мазнина за готвене и салати.'),
F('peanutbutter','Фъстъчено масло','fats','гладко, без сол',598,22.2,22.3,51.4,5,'🥜','Калорично плътен продукт; следи порцията.'),
F('chocolate','Черен шоколад','fats','70–85% какао',598,7.79,45.9,42.6,10.9,'🍫','Съдържа мазнини и въглехидрати.'),
F('banana','Банан','fruit','суров',89,1.09,22.84,0.33,2.6,'🍌','Удобен плод преди или след активност.',173944),
F('apple','Ябълка','fruit','сурова, с кора, Golden Delicious',57,0.28,13.6,0.15,2.4,'🍎','Плод с вода и фибри.',168202),
F('orange','Портокал','fruit','суров',47,0.94,11.75,0.12,2.4,'🍊','Съдържа витамин C.'),
F('blueberry','Боровинки','fruit','сурови',57,0.74,14.49,0.33,2.4,'🫐','Плодове с разнообразни растителни вещества.'),
F('strawberry','Ягоди','fruit','сурови',32,0.67,7.68,0.3,2,'🍓','Плод с ниска енергийна плътност.'),
F('broccoli','Броколи','veg','сурови',34,2.82,6.64,0.37,2.6,'🥦','Зеленчук с фибри и микронутриенти.'),
F('spinach','Спанак','veg','суров',23,2.86,3.63,0.39,2.2,'🥬','Листен зеленчук с минерали.'),
F('carrot','Морков','veg','суров',41,0.93,9.58,0.24,2.8,'🥕','Съдържа бета-каротин.'),
F('tomato','Домат','veg','суров',18,0.88,3.89,0.2,1.2,'🍅','Подходящ за свежи салати.'),
F('cucumber','Краставица','veg','сурова, с кора',15,0.65,3.63,0.11,0.5,'🥒','Високо водно съдържание.'),
];
const staticPlank=exercises.find(e=>e.id==='Plank');
if(staticPlank){staticPlank.photo='https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Plank/1.jpg';staticPlank.photo2=staticPlank.photo;}
window.FORME_DATA={exercises,workouts,foods};
})();