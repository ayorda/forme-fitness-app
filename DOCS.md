# FORME — карта на документацията

Тази страница събира всички документи на едно място и ги подрежда по теми. Ако започвате отначало, прочетете в този ред: **README.md** (какво е приложението и текущата версия) → **ROADMAP.md** (план и напредък) → **DEV.md** (как е устроен кодът). Документите, отбелязани с „исторически“, описват стари или отменени решения и се пазят само за справка.

## Старт и план

- [README.md](./README.md) — начална страница: какво е FORME, текуща версия и връзки.
- [ROADMAP.md](./ROADMAP.md) — план по фази, напредък 13/20 и блокиращи зависимости.
- [MASTER-ACCEPTANCE.md](./MASTER-ACCEPTANCE.md) — пълният оставащ обхват и критериите за финално приемане.
- [DEMO.md](./DEMO.md) — кратък сценарий за демонстрация на приложението при защита.
- [CHANGELOG.md](./CHANGELOG.md) — списък на промените по версии.

## Разработка и архитектура

- [DEV.md](./DEV.md) — наръчник за разработчика: карта на файловете, тестове, поддръжка.
- [AGENTS.md](./AGENTS.md) — правила за AI агентите, които работят по проекта (на английски).

## Акаунти, синхронизация и данни

- [ACCOUNT-ARCHITECTURE.md](./ACCOUNT-ARCHITECTURE.md) — защо е избран Firebase Authentication при бюджет 0 €.
- [ACCOUNT-SETUP.md](./ACCOUNT-SETUP.md) — как е създаден и настроен безплатният Firebase проект.
- [ACCOUNT-LIVE-TEST.md](./ACCOUNT-LIVE-TEST.md) — окончателна проверка на реалния вход с Firebase.
- [AUTO-SYNC-ARCHITECTURE.md](./AUTO-SYNC-ARCHITECTURE.md) — автоматична синхронизация по записи между устройства (задача 3.2).
- [CLOUD-ARCHITECTURE.md](./CLOUD-ARCHITECTURE.md) — ръчно прехвърляне на архив през акаунта (допълнителен инструмент).
- [LOCAL-DATA-CONTROLS.md](./LOCAL-DATA-CONTROLS.md) — износ и почистване на неактивни локални копия в браузъра.
- [MAINTENANCE.md](./MAINTENANCE.md) — поддръжка на маркерите, останали след изтриване на акаунт.
- [RETENTION-PROCESS-DRAFT.md](./RETENTION-PROCESS-DRAFT.md) — предложение за операторски процес по задържане на данни (чака одобрение).

## Сигурност и поверителност

- [PRIVACY.md](./PRIVACY.md) — какви данни се пазят, къде и как се изтриват.
- [SECURITY-REVIEW.md](./SECURITY-REVIEW.md) — ограничен технически преглед на защитата и поправките.
- [BROWSER-SECURITY.md](./BROWSER-SECURITY.md) — Content Security Policy и ограничения на хостинга.

## Медии (изображения, видео, звук, шрифтове)

- [CONTENT-AUDIT.md](./CONTENT-AUDIT.md) — одит на хранителните данни и изображенията на храни и упражнения.
- [MEDIA-DELIVERY-CHECKLIST.md](./MEDIA-DELIVERY-CHECKLIST.md) — контролен списък за проверка на медийните файлове.
- [VIDEO-SOURCES.md](./VIDEO-SOURCES.md) — източници, лицензи и обработка на видеодемонстрациите.
- [FORME-EXERCISE-VIDEO-STYLE-GUIDE.md](./FORME-EXERCISE-VIDEO-STYLE-GUIDE.md) — стандарт v4.1 за видеа: реално заснето движение + FFmpeg.
- [AI-VIDEO-PROVENANCE.md](./AI-VIDEO-PROVENANCE.md) — отменен план за AI видео (WAN 3.0) — исторически
- [YOGA-MUSIC.md](./YOGA-MUSIC.md) — оригиналната йога музика: режими, произход и ограничения.
- [FONT-SOURCES.md](./FONT-SOURCES.md) — локалните шрифтове, техните лицензи и контролни суми.

## Качество и проверки (QA)

### Изображения, видео и звук

- [QA-EXERCISE-NANO-SELECTION.md](./QA-EXERCISE-NANO-SELECTION.md) — трите избрани от собственика Nano Banana Pro изображения, v0.16.3.

- [QA-EXERCISE-HIGGSFIELD.md](./QA-EXERCISE-HIGGSFIELD.md) — текущи пет Higgsfield корекции със запазване на сцена/стил (v0.16.2).

- [QA-EXERCISE-EXACT-MATCH.md](./QA-EXERCISE-EXACT-MATCH.md) — предходен строг преглед (v0.15.6); пет ID са заменени във v0.16.2.
- [QA-EXERCISE-IMAGES.md](./QA-EXERCISE-IMAGES.md) — преглед v0.15.4, частично отменен от строгия преглед — исторически
- [QA-VIDEO.md](./QA-VIDEO.md) — текущи проверки на видеото и плейъра.
- [QA-VIDEO-REAL-V4.md](./QA-VIDEO-REAL-V4.md) — избор и преглед на реалния клип Parallel Bar Dips.
- [QA-VIDEO-VISUAL-AUDIT.md](./QA-VIDEO-VISUAL-AUDIT.md) — визуален одит на старите кандидати за Dips — исторически
- [QA-AI-VIDEO.md](./QA-AI-VIDEO.md) — подготовка на AI видео по отменения план — исторически
- [QA-AUDIO.md](./QA-AUDIO.md) — проверки на йога музиката и аудио жизнения цикъл.
- [QA-FONTS.md](./QA-FONTS.md) — проверки на локалната типография.

### Достъпност и интерфейс

- [QA-A11Y.md](./QA-A11Y.md) — текущ автоматичен одит на достъпността и поправки (v0.15.3).
- [QA-ACCESSIBILITY.md](./QA-ACCESSIBILITY.md) — резултати от axe прегледа плюс по-стари одити.
- [QA-MODALS.md](./QA-MODALS.md) — изолиране на диалозите и управление на фокуса.
- [QA-MOBILE.md](./QA-MOBILE.md) — ръчни проверки на реален iPhone.
- [QA-PWA-UPDATE.md](./QA-PWA-UPDATE.md) — проверка на обновяването на инсталираното PWA.
- [QA-RESILIENCE.md](./QA-RESILIENCE.md) — устойчивост на локалните данни при повреди.

### Функции за тренировки

- [QA-JOURNAL.md](./QA-JOURNAL.md) — тренировъчен дневник: серии, тежест и напредък.
- [QA-SKILLS.md](./QA-SKILLS.md) — пътеките Skill Trees (Pull-Ups, Dips, Handstand и др.).
- [QA-RECOVERY.md](./QA-RECOVERY.md) — дневник за сън и възстановяване.
- [QA-PERSONALIZATION.md](./QA-PERSONALIZATION.md) — персонализиран четириседмичен план по прозрачни правила.

### Акаунти, синхронизация и данни

- [QA-ACCOUNTS.md](./QA-ACCOUNTS.md) — реални акаунти и навигация след вход.
- [QA-PERSISTENT-LOGIN.md](./QA-PERSISTENT-LOGIN.md) — постоянно вписване, прието на реален iPhone.
- [QA-AUTO-SYNC.md](./QA-AUTO-SYNC.md) — проверки и статус на автоматичната синхронизация.
- [QA-SYNC.md](./QA-SYNC.md) — проверки на стария ръчен облачен архив — исторически
- [QA-MIGRATION.md](./QA-MIGRATION.md) — локална основа за миграция във v0.7.2 — исторически
- [QA-SAFE-RESTORE.md](./QA-SAFE-RESTORE.md) — безопасно ръчно възстановяване от архив.
- [QA-LOCAL-COPIES.md](./QA-LOCAL-COPIES.md) — проверки на почистването на локални копия.
- [QA-MAINTENANCE.md](./QA-MAINTENANCE.md) — операторско почистване на маркери след изтриване.

### Сигурност, поверителност и бизнес

- [QA-PRIVACY.md](./QA-PRIVACY.md) — проверки на екрана за данни и изтриването на акаунт.
- [QA-BROWSER-SECURITY.md](./QA-BROWSER-SECURITY.md) — повторима браузърна проверка на CSP.
- [QA-ACCESS.md](./QA-ACCESS.md) — проверки на основата Free/Pro.
- [QA-SERVICES.md](./QA-SERVICES.md) — проверки на Programs и Personal Coaching.

## Бизнес и бъдещи услуги

- [ACCESS-ARCHITECTURE.md](./ACCESS-ARCHITECTURE.md) — архитектура Free/Pro без активни плащания.
- [SERVICES-ARCHITECTURE.md](./SERVICES-ARCHITECTURE.md) — подготовка за Programs и Personal Coaching с реален треньор.
- [PAYMENTS-PLAN.md](./PAYMENTS-PLAN.md) — бъдещ подход към плащанията (не е активиран).
