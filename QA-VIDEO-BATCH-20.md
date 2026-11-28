# FORME — още 10 реални видеодемонстрации / v0.16.8

Изрично поискан втори пакет от десет нови клипа, 28.11.2026. Реално заснет материал + FFmpeg, стандарт v4.1. Предходните 11 клипа и всичките 156 изображения са запазени байт по байт. Активният каталог остава 48 упражнения; Handstand Push-Ups остава премахнат, личната история се запазва.

Техническо покритие: **21/48, още 27 без видео**. Тази доставка не завършва цялата задача 2.4 или продуктовия план: 13/20 основи, 7 незавършени и общо финално приемане. Реални iPhone/Android и независим треньор остават отделно приемане.

Четири стъпки: източници/права → визуален преглед → компресия/интеграция → проверки/main/CI/Pages/public. Локалните и публичните резултати се записват отделно; няма платени услуги, AI задачи или генерации.

## Файлове и източници

MP4/H.264 Main 3.1, yuv420p, faststart, 24 fps, без аудио. Десетте файла са общо **4 949 040 B**, **2090 кадъра / 87,083333 s**; всеки е под 1 MiB. JPEG постерите са от действителния първи кадър, а не от AI снимката. Имената са `media/exercise-videos/<id-с-тирета>-real-v1.mp4` и `-poster.jpg`.

| Упражнение | Автор / публичен източник | Време / кадри | Резолюция | MP4 байтове | CRF / SSIM | Снимка + начало / ключов / край |
|---|---|---:|---:|---:|---:|---|
| `Mountain_Climbers` | [Alexander Oliver](https://www.pexels.com/video/intense-workout-session-with-personal-trainer-31510696/) | 5.500 s / 132 | 960×540 | 477,500 | 22 / 0.989233 | [Сравнение](./qa/evidence/mountain-climbers-real-v1.jpg) |
| `Butt_Lift_Bridge` | [Ron Lach](https://www.pexels.com/video/people-in-retro-outfits-doing-hip-bridges-7928044/) | 9.000 s / 216 | 960×506 | 364,725 | 24 / 0.986258 | [Сравнение](./qa/evidence/butt-lift-bridge-real-v1.jpg) |
| `Dancers_Stretch` | [Kampus Production](https://www.pexels.com/video/a-man-in-a-seated-spinal-twist-pose-6298129/) | 9.625 s / 231 | 720×480 | 566,891 | 24 / 0.980747 | [Сравнение](./qa/evidence/dancers-stretch-real-v1.jpg) |
| `Groin_and_Back_Stretch` | [Pavel Danilyuk](https://www.pexels.com/video/a-man-doing-leg-stretches-4367540/) | 10.000 s / 240 | 960×540 | 443,338 | 24 / 0.989433 | [Сравнение](./qa/evidence/groin-and-back-stretch-real-v1.jpg) |
| `Kneeling_Hip_Flexor` | [olia danilevich](https://www.pexels.com/video/a-woman-in-a-low-lunge-pose-9003238/) | 7.000 s / 168 | 704×960 | 742,017 | 24 / 0.983256 | [Сравнение](./qa/evidence/kneeling-hip-flexor-real-v1.jpg) |
| `Calf_Stretch_Hands_Against_Wall` | [Ketut Subiyanto](https://www.pexels.com/video/couple-doing-exercise-together-4858889/) | 10.583 s / 254 | 960×540 | 665,610 | 24 / 0.980316 | [Сравнение](./qa/evidence/calf-stretch-hands-against-wall-real-v1.jpg) |
| `Handstand` | [Ketut Subiyanto](https://www.pexels.com/video/woman-doing-a-handstand-5029212/) | 8.375 s / 201 | 960×540 | 290,504 | 24 / 0.989428 | [Сравнение](./qa/evidence/handstand-real-v1.jpg) |
| `Frog_Stand` | [cottonbro studio](https://www.pexels.com/video/side-view-of-man-doing-yoga-pose-6799574/) | 16.000 s / 384 | 960×506 | 416,785 | 24 / 0.995983 | [Сравнение](./qa/evidence/frog-stand-real-v1.jpg) |
| `Ring_Muscle_Up` | [cottonbro studio](https://www.pexels.com/video/a-man-exercising-on-pull-up-rings-7672116/) | 8.000 s / 192 | 506×960 | 557,611 | 24 / 0.980819 | [Сравнение](./qa/evidence/ring-muscle-up-real-v1.jpg) |
| `Hanging_Leg_Raise` | [Markofit  Production](https://www.pexels.com/video/a-shirtless-man-training-at-a-fitness-center-10441577/) | 3.000 s / 72 | 600×720 | 424,059 | 24 / 0.983148 | [Сравнение](./qa/evidence/hanging-leg-raise-real-v1.jpg) |

Всички нови източници са публикувани и одобрени Pexels видеа според собствената им публична metadata страница. Лицензът е [Pexels](https://www.pexels.com/license/), проверен 28.11.2026 за вграждане и адаптация в приложение. Не е CC/MIT лиценз. Не се предлага самостоятелна stock библиотека или препродажба; не се твърдят партньорство, одобрение на продукта или независимо проверени индивидуални model/property releases. Автор, точен source URL и rendition, оригинален SHA/байтове/ffprobe, trim/crop/grade и крайни SHA са в [манифеста](./media/exercise-videos/manifest.json). Изходните големи файлове са извън приложението и хранилището.

## Преглед и ограничения

Всичките 2090 крайни кадъра са разгледани последователно в 48-кадрови листове, с увеличение на ключови опори/стави. CRF 22/24/26 са сравнени визуално при еднакъв кадър и спрямо lossless FFV1 след същите crop/grade/scale/FPS операции; SSIM е с изравнен timebase. VMAF не е измерван. CRF 22 е избран за бързия планински катерач; останалите са CRF 24. Портретното разтягане и прасецът са над меката цел 600 KB, за да останат четливи. Няма промяна на скорост, reverse, loop, padding, синтетични кадри или подмяна на фон.

Статичните клипове са ограничени демонстрации на показаната позиция. Handstand показва само задържане; Frog Stand — пренасяне и задържане; едностранните разтягания не показват винаги смяна/изход. Това е изрично описано под плеъра на трите езика. **Не са пълен урок за безопасно влизане/излизане.** Полето `fullMovement` в текущия общ gate означава цяла показана демонстрационна фаза; за тези записи не означава измислен или невидим вход/изход. Не се твърди независимо треньорско приемане.

### Mountain_Climbers

Continuous high-plank mountain climbers with fixed palms, extended elbows and alternating knee drives; multiple complete left/right cycles, no external assistance or load.

Ограничения и сравнение със снимката: Neutral light-gray training room with a trainer behind who does not touch the athlete. Red shoes and brighter room differ from the charcoal/olive photograph. Far arm/leg overlap in this oblique view; quick feet have natural motion blur. No claim of frame-perfect hip alignment.

### Butt_Lift_Bridge

At least two complete unloaded supine hip-bridge cycles: hips lower to the mat, extend and return; foreground athlete's palms, shoulders and heels stay supported.

Ограничения и сравнение със снимката: Three athletes in a beige/brick studio; foreground subject selected for technique, background participants partly overlap. Muted pastel outfits differ from the dark gym photograph. No resistance band, ball or partner assistance. Earlier single-rise/hold source rejected for incomplete return.

### Dancers_Stretch

One straight leg, the opposite foot crossed over it; supporting palm placed behind, torso turns gently into seated spinal twist and holds. This is a one-sided entry/hold demonstration, not a two-sided cycle or exit tutorial.

Ограничения и сравнение със снимката: Coastal outdoor setting, purple top and pink mat differ from the gym photograph; moderate desaturation only. Safe fixed crop enlarges athlete while retaining head, supporting hand and both feet throughout. No forced end-range rotation; far foot partly overlaps the knee.

### Groin_and_Back_Stretch

Seated butterfly: soles together, knees open, hands on feet; natural hold followed by releasing hands and drawing knees inward into rest, with no forced knee pressure.

Ограничения и сравнение със снимката: Dim real gym, gray sleeveless top, black trousers and subtle purple light differ from olive reference. Feet and hands visible, some far-leg overlap. Head slightly flexed naturally; cue avoids forcing the neck or pulling knees down. Opening into the butterfly occurs before source start.

### Kneeling_Hip_Flexor

One-sided low lunge with rear knee/shin supported, front sole flat; hands rise from beside hips to overhead and natural hold follows. Demonstrates supported hip-flexor position, not switching sides or exiting.

Ограничения и сравнение със снимката: Outdoor dark foliage, pale pink/gray clothing and mat differ from gym. Fixed portrait crop retains hands, head, front foot and rear knee/toes; interval stops before later deeper backbend. Arms-overhead variation is explicitly disclosed; cue asks for gentle pelvic tuck and no lumbar arch.

### Calf_Stretch_Hands_Against_Wall

One-sided wall calf-stretch hold: both palms on wall, front knee flexed, rear leg extended and heel grounded. Natural balance/breathing movement, no bouncing; not a side-switch or entry/exit tutorial.

Ограничения и сравнение със снимката: Two athletes independently hold the same stretch against an outdoor gray wall; foreground athlete and all important supports visible. Purple-patterned leggings and brighter pavement differ from gym photo. Small far-hand/leg overlap and real tiny clothing marks remain; no affiliation claimed.

### Handstand

Static BACK-to-wall handstand hold on both palms, elbows extended, feet together against wall, shoulders supporting body. Hold only: entry and exit are not shown and are not taught by this clip.

Ограничения и сравнение със снимката: Bright white studio, black top/gray leggings and gentle camera pullback differ from dark gym photograph. Initial source kick-up omitted because a foot approached/left frame; retained hold keeps hands, head and feet visible. Hair partly overlaps far wrist, face looks forward; cue keeps neck comfortable and requires prior safe-exit skill. Never describe this as chest-to-wall.

### Frog_Stand

Slow weight shift onto palms with knees resting on upper arms, one foot lifts then the second; both feet balance freely in frog stand and hold. Entry plus hold, no recorded exit; not a full entry/exit cycle.

Ограничения и сравнение със снимката: White studio/platform and black shorts differ from gym floor photo. Elbows flex during the balance phase; side view partly overlaps far wrist/knee/foot. Platform is visible, not hidden assistance; cue recommends learning on a low stable surface with a safe forward landing. No strength or technique certification inferred.

### Ring_Muscle_Up

One complete DYNAMIC/kipping ring muscle-up from straight-arm hang, natural knee drive/pull, transition over the rings and push into straight-arm support. No contact from observing trainer, external load or foot support.

Ограничения и сравнение със снимката: Dark real brick/wood gym, gray-mint tank top and moving camera differ from olive photo; mild brightness/gamma lift preserves grip detail. This is a dynamic advanced variation, NOT a strict muscle-up. Both hands remain on separate rings, feet stay free; far arm briefly overlaps torso. First interval rejected because pull had already begun; revised interval includes hang. Descent is not included; full movement here means hang-to-support.

### Hanging_Leg_Raise

One complete hanging leg raise from legs down, lift to about hip height and controlled return to legs down. Both hands on fixed handles; knees slightly flexed, no toe-to-bar contact, no external load or assistance.

Ограничения и сравнение със снимката: Warm ochre gym, shirtless athlete, black shorts and portrait crop differ visibly from dark olive photo. Moderate desaturation reduces orange dominance without fake recoloring. Head, both grips and feet remain within crop throughout. Small natural pendulum movement remains; cue asks to avoid generating swing rather than claiming motionless torso. Earlier interval rejected for incomplete return.

## Отхвърлени кандидати

Отхвърлени са straight-bar dips, погрешно описани като muscle-up; inverted pike на халки вместо back lever; TRX rows с пети на варел вместо front lever; страничен планк с прав лакът вместо каталожния вариант на предмишница; записи с изрязани глава/стъпала, скрити опори, добавена лента/топка и непълна важна динамична фаза. Първият мост имаше само повдигане/задържане; заменен е с пълни цикли. Първият интервал за Ring Muscle-Up започваше след дърпането; върнат е към прав вис. Първият Hanging Leg Raise нямаше пълно спускане; избран е нов интервал. При Handstand първоначалното засилване е изключено заради стъпало на ръба/извън кадър. Нито един отказан кандидат не е в активния каталог.

## Интеграция и регресии

- Само десет нови `demoVideo` връзки и десет BG/EN/DE cue реда; предишният каталог, тренировки, прогресии, потребителски данни, Auth и синхронизация не са променяни.
- Целите `app.js`, `styles.css`, `DOCS.md` и останалите приноси на rrusev548 са запазени. Няма промяна на навигация/More/теми/home/карти/действия/план/AI disclosure.
- Native player остава `controls`, `playsinline`, `preload=none`, без autoplay; първото пускане кешира пълен 200 и позволява 206/416/If-Range и офлайн seek.
- `VIDEO_CACHE` остава `forme-video-v0143-dips2`: добавени са 20 нови разрешени URL (MP4+постер), общо 42; старите байтове не се подменят. Няма видео при install/precache.
- Shell `forme-mobile-v0168-videos20`, `data/interface-translations?v=0168`; непроменените `app?v=0167`, `styles?v=0166`, `exercise-photos?v=0165` и `skill-trees?v=0164` остават с точните URL в HTML/SW.

## Проверки на доставката

Финални локални резултати:

- 884/884 Node теста; 17 видео +14 image-gate Python теста; 38 production JavaScript parse проверки.
- 300 axe изгледа, 0 нарушения; 54 защитени DOM сравнения с предходния main и 3 офлайн сценария със запазени данни.
- 126 онлайн +126 офлайн видео сценария (21 клипа × 3 езика × 2 размера); 21 пълни възпроизвеждания с естествена скорост. Native Play/Pause/Replay/Seek, preload-none/reduced-motion, MP4 decode, cache SHA/пълен200,206/416/If-Range и fallback са проверени.
- Нула JavaScript/CSP грешки и production Firebase заявки. Реалният activate handler изчиства само стария shell, запазва видео/изображения/аудио; няма масово video precache.
- Целите app.js/CSS/DOCS, предишните 11 видео записа/файла, 156 изображения и всички други каталожни полета/тренировки са сравнени с main `f2b6021188424945d9c7eb20e8bb86fa9f2c250f` и са идентични.

GitHub Actions, Pages и публичните ресурси се проверяват след push на точния commit; резултатът се отчита отделно след публикуването. Браузърна емулация не означава проверен физически телефон. Общият край на продукта няма надеждна дата без останалите медии/права, устройства и приемане.
