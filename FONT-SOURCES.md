# FORME — локални шрифтове и права

v0.15.1 · проверено 17.11.2026 · Фаза 1 / задача 1.1 (типография) и техническо допълнение към 3.3.5. Обхватът е локално доставяне на съществуващите DM Sans и Space Grotesk. Няма подмяна на модела, нов шрифт или промяна на тренировъчните функции.

| Семейство | Авторство в официалния лиценз | Локален лиценз |
| --- | --- | --- |
| DM Sans | Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts) | [SIL Open Font License 1.1](./media/fonts/OFL-DM-Sans.txt) |
| Space Grotesk | Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk) | [SIL Open Font License 1.1](./media/fonts/OFL-Space-Grotesk.txt) |

OFL 1.1 допуска използване, вграждане и разпространяване в приложение, включително търговско, при запазване на copyright и лиценза. Файловете на шрифтовете остават под OFL, а не се преобозначават с лиценза на приложението. Не се продават самостоятелно и не се заявява одобрение от авторите. Непроменените оригинални license файлове са включени като отделни публично достъпни файлове; CRLF/байтовете им са запазени.

## Източници и файлове

Използвани са официалните WOFF2 от Google Fonts, извлечени от [CSS API](https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..800&family=Space+Grotesk:wght@400..700&display=swap). Официалните лицензи са независимо сверени с [google/fonts/ofl/dmsans](https://github.com/google/fonts/tree/main/ofl/dmsans) и [google/fonts/ofl/spacegrotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk).

[Манифестът](./media/fonts/manifest.json) съдържа точния provider URL, subset, CSS weights/unicode ranges, байтове и SHA-256 за всеки файл, както и Git blob SHA и SHA-256 за оригиналните лицензи. Provider URLs са версия v17 / v22. Файловете се копират **без преобразуване, subset, редакция на glyph, вътрешно преименуване или премахване на metadata**; променени са само URL адресите в CSS към локалните имена.

Пет файла: DM Sans Latin 36 932 B + Latin Extended 18 228 B; Space Grotesk Latin 22 288 B + Latin Extended 18 940 B + Vietnamese 6 712 B. Общо **103 100 B**. Запазени са всички subsets, които текущата официална CSS декларация предоставя за двете семейства. Приложението продължава да заявява normal 400–800 за DM Sans и 400–700 за Space Grotesk.

Независим локален прочит на реалните WOFF2 с fontTools 4.61.1/Brotli 1.2.0 установява DM Sans Version 4.004 (variable wght 100–1000) и Space Grotesk Version 2.000 (variable wght 300–700). Latin файловете съдържат немските ÄÖÜäöüß. Тези font subsets **нямат кирилица**: българските букви запазват съществуващия system-ui/-apple-system/sans-serif fallback. Не се твърди, че DM Sans/Space Grotesk изобразяват кирилицата или че системният шрифт е идентичен между операционни системи.

## Зареждане и поверителност

Няма външен CSS import, preconnect или runtime font заявка към Google Fonts. Двете Latin лица се preload-ват с правилния font/woff2/crossorigin режим; останалите subsets се използват според unicode-range. `font-display: swap` запазва четим текст докато се зареждат или при грешка. Петте малки файла влизат в shell precache за офлайн старт след успешна първа инсталация. Няма добавяне на аудио/видео към install precache.

CSP `font-src self`, `style-src self unsafe-inline` премахва старите font provider origins. Inline CSS изключението остава за съществуващите динамични барове/графики. CSS и изменените shell/translation URL са версионирани, за да не се зареди старият външен import от предходен SW кеш. Image, video и Yoga Music кешовете се запазват; Auth/SDK/Rules/синхронизацията и потребителските данни не се променят.

Това премахва външните font заявки, а не всички технически заявки на приложението: сайтът се обслужва от GitHub Pages, а избраното използване на акаунт/облак се обслужва от Firebase. Виж [PRIVACY.md](./PRIVACY.md) и [BROWSER-SECURITY.md](./BROWSER-SECURITY.md).

[QA-FONTS.md](./QA-FONTS.md) описва действителната браузърна употреба, offline byte/decode проверки и оставащото приемане на физически устройства. Платени услуги или покупки не са активирани; бюджет 0 €.
