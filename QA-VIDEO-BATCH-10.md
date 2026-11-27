# FORME v0.16.7 — още десет реални видеодемонстрации

## Обхват и стандарт

На 27.11.2026 собственикът поиска 10 допълнителни клипа и изрично потвърди **„Реални видеа + FFmpeg — последният стандарт v4.1“**. Без AI генерации, платени услуги или абонаменти. Това е ограничен пакет от задача 2.4: **11/48 активни упражнения вече имат клип,37 остават**. Общият план остава 13/20 основи +7 незавършени и общо приемане. Handstand Push-Ups остава пенсиониран, съществуващият Dips MP4/постер и всички 156 снимкови файла остават непроменени.

## Доставени файлове

| Упражнение | s / кадри | Размери | MP4 B | CRF / SSIM |
| --- | --- | --- | --- | --- |
| [Pushups](./media/exercise-videos/pushups-real-v1.mp4) | 8 / 192 | 960×420 | 564,604 | 22 / 0.984322 |
| [Pullups](./media/exercise-videos/pullups-real-v1.mp4) | 6 / 144 | 640×688 | 573,923 | 22 / 0.98829 |
| [Plank](./media/exercise-videos/plank-real-v1.mp4) | 8 / 192 | 960×506 | 231,630 | 22 / 0.991165 |
| [Bench_Dips](./media/exercise-videos/bench-dips-real-v1.mp4) | 8.5 / 204 | 960×540 | 804,165 | 24 / 0.979155 |
| [Childs_Pose](./media/exercise-videos/childs-pose-real-v1.mp4) | 9.25 / 222 | 960×540 | 634,635 | 24 / 0.980618 |
| [Arm_Circles](./media/exercise-videos/arm-circles-real-v1.mp4) | 10.5 / 252 | 540×960 | 610,045 | 24 / 0.97422 |
| [Shoulder_Stretch](./media/exercise-videos/shoulder-stretch-real-v1.mp4) | 8.25 / 198 | 960×392 | 595,577 | 22 / 0.982231 |
| [Cat_Stretch](./media/exercise-videos/cat-stretch-real-v1.mp4) | 14 / 336 | 960×646 | 820,612 | 24 / 0.985134 |
| [Seated_Floor_Hamstring_Stretch](./media/exercise-videos/seated-floor-hamstring-stretch-real-v1.mp4) | 13.5 / 324 | 960×540 | 601,518 | 24 / 0.983745 |
| [Bodyweight_Squat](./media/exercise-videos/bodyweight-squat-real-v1.mp4) | 4.5 / 108 | 380×570 | 229,580 | 22 / 0.983602 |

MP4/H.264 Main 3.1/yuv420p/faststart,24 fps, без аудио или ненужни метаданни. Общо **5 666 289 B MP4**,90,5 s / 2172 кадъра. Размерът е 229580–820612 B; всички са под 1 MiB. Продължителността следва реалното движение. Статичните задържания не са freeze. Няма ускоряване, reverse, loop/padding или генерирано движение. CRF22/24/26 са сравнени със същата FFV1 crop/grade/scale/FPS референция и изравнени времеви бази. SSIM не оценява техниката; VMAF не е измерван. По-дългите демонстрации запазват четливостта пред по-нисък размер.

## Реален визуален преглед

Всички 2172 крайни кадъра са извлечени и последователно прегледани в листове по 64 кадъра, с проверка на общия брой и SHA на крайния MP4. Начални, крайни и ключови кадри и CRF варианти са прегледани в по-голям размер. Браузърният сценарий отделно проверява реално възпроизвеждане с playbackRate 1, пълен край, пауза, replay и seek. Това е вътрешен преглед, а не независима треньорска сертификация.

Крайният покой при Childs Pose е скъсен с 1,25 s, за да остане цялата глава в кадър след освобождаването на позата. Отхвърлени са първият 6s отрязък Pushups (няма завършено избутване), първият crop на Cat Stretch (отрязва част от главата при разгъване) и първият кандидат Squat (доминиращ светлосин фон). Финалните интервали/crop са преработени и прегледани отново. Оригиналите и отхвърлените кандидати остават извън публичното хранилище.

- **Pushups**: Straight-arm support, controlled descent, low chest, return to straight-arm support; one complete repetition in8s. Palms and both toes remain grounded. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Dark gym and neutral shirt; light blue shorts and yellow/red background differ from the olive reference. Far arm/leg partly overlapped in side view. Earlier6s interval rejected because return was incomplete. [Снимка/start/ключов/end кадър](./qa/evidence/pushups-real-v1.jpg).
- **Pullups**: Overhand grips on horizontal bar, free feet, top-to-straight-arm-hang-to-top cycles; no pad, band or external weight. Both hands stay fixed. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Rear view and portrait crop instead of the frontal photograph; bright real gym and small rack branding. Foreground bench partly overlaps feet at lowest hang; working shoulders/elbows/grips remain visible. [Снимка/start/ключов/end кадър](./qa/evidence/pullups-real-v1.jpg).
- **Plank**: Continuous forearm-and-toe support, elbows planted, trunk held stable, natural breathing and a small head adjustment; no fake freeze. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Frontal foreshortening limits lumbar-angle assessment. Gray/brown curtains and wood floor differ from gym photo. Brief initial upward gaze then neutral neck; cue explicitly asks neutral neck. [Снимка/start/ключов/end кадър](./qa/evidence/plank-real-v1.jpg).
- **Bench_Dips**: Fixed hands on ledge behind hips, controlled elbow bend and press to support, heels grounded; multiple full bench-dip repetitions. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Outdoor brick setting and straight-leg variant differ from bent-knee photo. Far hand partly occluded; near palm/elbow and shoulder remain readable. Small CORE shirt mark retained, no endorsement implied. [Снимка/start/ключов/end кадър](./qa/evidence/bench-dips-real-v1.jpg).
- **Childs_Pose**: Kneeling on heels, hands slide forward, torso lowers into child pose with head down, natural hold, then controlled release toward upright kneeling. Final rest omitted to keep the entire head visible, hands still on mat. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Brick/window studio and muted blue mat instead of dark gym. Gentle camera movement; far-side hand partly overlapped but both arms, knees and feet stay within frame. [Снимка/start/ключов/end кадър](./qa/evidence/childs-pose-real-v1.jpg).
- **Arm_Circles**: Repeated large alternating arm circles, straight elbows, stable standing feet, no external load. Shoulder rotation remains continuous and natural. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Large alternating circles are the wider-range variation, not the small bilateral circles of the introductory photo/instructions; localized cue states this explicitly. Neutral wall, portrait frame and black clothing; hand motion blur is natural. [Снимка/start/ключов/end кадър](./qa/evidence/arm-circles-real-v1.jpg).
- **Shoulder_Stretch**: Cross-body arm hold, controlled release/switch, opposite cross-body hold; supporting hand is on upper arm rather than levering the elbow. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Upper-body crop intentionally excludes legs, which do not perform this stretch; hands, elbows, shoulders and head stay visible. Outdoor gray wall and natural side light; partial far-arm overlap. [Снимка/start/ключов/end кадър](./qa/evidence/shoulder-stretch-real-v1.jpg).
- **Cat_Stretch**: All-fours support with hands and knees grounded; rounded cat-to-extension-to-rounded cat cycle, no lifting of limbs or substituted pose. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Neutral yoga studio and muted green mat; gentle camera pullback. Far limbs partly overlap. First crop rejected for clipping raised head; revised crop retains head throughout extension. Do not force the neck to the model's full range. [Снимка/start/ключов/end кадър](./qa/evidence/cat-stretch-real-v1.jpg).
- **Seated_Floor_Hamstring_Stretch**: Both knees extended in seated forward fold, controlled reach and natural hold, then hands release and torso returns upright; no bouncing. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Bilateral straight-leg version follows written catalogue steps; photo has one leg folded. Home room/gray sofa with small muted orange pillows differs from gym. Far leg partly overlapped; no exact spinal-angle certification. [Снимка/start/ключов/end кадър](./qa/evidence/seated-floor-hamstring-stretch-real-v1.jpg).
- **Bodyweight_Squat**: Standing support, knees bend in line with feet, controlled squat and complete stand; feet remain planted and no added weight or assistance appears. Ограничения: Internal visual review, not independent trainer certification or physical-phone acceptance. Frontal cropped real gym, gray outfit, face mask and small yellow stripe behind subject; differs from dark side-view reference. Clip ends before another person enters the original. No artificial background replacement. [Снимка/start/ключов/end кадър](./qa/evidence/bodyweight-squat-real-v1.jpg).

Реалните неутрални спортни дрехи и умерената индивидуална цветова корекция поддържат четливостта. Не се твърди идентичен фон/човек/осветление спрямо AI снимката. Част от сцените са на открито, в йога студио или домашна среда. Няма подмяна на фон/самоличност. При Arm Circles е показан широк редуващ се вариант, изрично назован под плеъра; при Bench Dips краката са изпънати; при seated hamstring и двата крака са изпънати според писмените инструкции.

## Права и повторимост

Десетте материала са от публичните страници на **Pexels**, с точен автор, ID/slug, published/approved/Pexels licence snapshot, рекламирован MP4 rendition, дата на публикацията, оригинални байтове/SHA/ffprobe и source-specific processingPlan в [манифеста](./media/exercise-videos/manifest.json). [Pexels License](https://www.pexels.com/license/), проверен27.11.2026, разрешава обработка и включване в сайтове/приложения. Това са обработени учебни компоненти с оригинални указания и видимо авторство/източник/лиценз, без stock библиотека, самостоятелна препродажба или твърдение за одобрение от моделите. Индивидуални model/property releases не са независимо проверени; лицензът не предоставя автоматично права върху марки. Материалите не се преименуват на CC/MIT. Copyright лицензът е отделен от оценката на техниката.

`qa/prepare-real-video.py` не е отслабен: SHA guard, валиден непрекъснат интервал, умерени crop/grade граници, без upscaling/произволни филтри, неприети кандидати извън каталога. Към `qa/video_policy.py` и собствения `exerciseVideo()` е добавен отделен строг Pexels договор. Неизвестни домейни/лицензи, различни ID/renditions, pending/AI произход и непълни прегледи се отказват.

## Плеър, кеш и запазена работа

Съществуващият native плеър е запазен: controls/playsinline/preload none/no autoplay, JPEG от реалния MP4, BG/EN/DE техника/credit/лиценз/промени и резервен текст при грешка. Portrait и landscape използват стария contain, без CSS промени. Видео не се тегли при инсталиране/отваряне на каталога.

20 нови versioned URL са добавени към точния allowlist. **Съществуващият VIDEO_CACHE0143 е запазен умишлено**: добавяме нови клипове, без подмяна на старите Dips байтове/URL, и пазим вече гледания Dips офлайн. Нов shell `forme-mobile-v0167-videos10`; app/data/interface-translations?v0167 съвпадат точно между HTML и ASSETS. Старите стилове?v0166, photos?v0165 и skill-trees?v0164 са непроменени. Lazy cache съхранява целия 200 отговор;206/416/If-Range работят при seek и офлайн. Изображения, звук и потребителски данни се запазват.

Добавките на rrusev548 от PR51 остават непокътнати: всички app.js извън собствения exerciseVideo(), целият CSS, DOCS.md, home/navigation/More/themes/categories/cards/actionmenus/plan placement/disclosure/a11y. Данните за акаунти, синхронизация, Firebase и тренировъчна история не се променят. Частната проверка сравнява суровите файлове с e427fc8 и упражнява legacy HSPU favorite/history.

## Проверки и оставащо приемане

Локално: 883 Node теста са успешни; след последните промени във видео компонента и Childs Pose са повторени всички 47 засегнати теста. Успешни са 17 Python видео проверки, 14 image gate проверки, 38 production JavaScript parse проверки и аудио/видео byte/codec audit. Достъпност: 300 изгледа, 0 axe нарушения; 54 сравнения на защитените DOM компоненти и 3 офлайн случая със запазени данни. Първоначални остарели очаквания за pending видео/README брой са коригирани; първият axe преглед откри source/licence линкове само по цвят — поправени с подчертаване само в собствения видео компонент. Cache upgrade тестът изчаква действителното activated състояние, преди да проверява изтриването на стария shell. Не се променя Service Worker механизмът заради тестовата надпревара.

Точният CI/Pages/public статус се записва след реалното изпълнение; не се извежда успех от подготовката. Повторими команди:

```sh
node --test test.js *.test.js
python3 -m unittest discover -s qa -p 'test_video_policy.py'
python3 qa/video-audit.py
FORME_CHROMIUM_EXECUTABLE=/usr/bin/chromium python qa/exercise-videos-browser.py
```

`qa/exercise-videos-browser.py` проверява 11 клипа × BG/EN/DE × 390/1280 px: лениво зареждане, native Play, pause/replay/seek, размери/продължителност, пълни 200 кеширани байтове/SHA,206/416/If-Range, офлайн reload/play/seek, Reduced Motion, запазени guest/legacy данни и cache upgrade със стар Dips/снимка/звук. Пълното възпроизвеждане на 11 клипа при нормална скорост е отделен BG/390 сценарий. Реални iPhone Safari/Home Screen и Android, както и независим преглед от квалифициран треньор, остават отделно приемане; браузърната емулация не ги заменя. Следващите 37 видеа изискват отделен подбор и преглед; няма надежден срок за целия продукт.

## Потвърден локален резултат преди main

Финалният видео сценарий завърши успешно: **66 онлайн случая + 66 офлайн случая**, 11 пълни възпроизвеждания при нормална скорост, 0 JavaScript/CSP грешки и 0 production Firebase заявки. Cache upgrade запази Dips/снимката/звука и премахна стария shell след activated. Реален missing-MP4 сценарий запази снимката и инструкциите и показа резервното съобщение. Image regression: всички 48 карти/детайла онлайн и офлайн в 6 BG/EN/DE mobile/desktop случая, запазени стар HSPU favorite/set/JSON архив и 0 заявки към пенсионирани assets. 54 защитени DOM сравнения и 300 axe изгледа са успешни. CI, Pages и публичните байтове се потвърждават отделно за точния commit след push.
