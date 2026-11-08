# Разработка и поддръжка на FORME

Кратък наръчник за човека, който пипа кода (и за защитата). Версията и точният брой тестове са в [README.md](./README.md).

## Карта на файловете

| Файл | Роля |
|---|---|
| `index.html` | Обвивка: странична лента, горна лента, навигация, мета данни, `<script>` редове |
| `app.js` | Всички екрани, тренировъчен плеър и таймер, localStorage, i18n извиквания |
| `core.js` | Чисти функции без DOM: калории по грамаж, филтри, часовник (тестват се директно) |
| `data.js` | Каталози: 49 упражнения, 6 тренировки, 30 храни + програми |
| `styles.css` | Целият стил, включително мобилните брейкпойнти и `prefers-reduced-motion` |
| `i18n.js`, `interface-translations.js`, `exercise-translations.js`, `food-translations.js`, `workout-translations.js`, `locale-content.js` | Триезичният слой (bg/en/de) |
| `exercise-photos.js`, `food-photos.js`, `media/` | Връзки към локалните WebP файлове; `media/manifest.json` пази произход, размери и SHA-256 |
| `state-normalizer.js`, `storage-schema.js` | Поправка и схема на повредени локални данни при стартиране |
| `progress.js`, `nutrition-journal.js`, `programs.js`, `backup.js` | Дневници, програми и JSON архив |
| `service-worker.js` | Офлайн кеш (`ASSETS` списъкът е пълната обвивка) |
| `*.test.js` | Автоматични тестове — виж „Тестове“ по-долу |
| `DEMO.md`, `QA-*.md`, `CONTENT-AUDIT.md`, `MEDIA-DELIVERY-CHECKLIST.md` | Сценарий за защита и документирани проверки |

## Тестове

```bash
node --test *.test.js
```

CI (`.github/workflows/final-check.yml`) изброява тестовите файлове **явно** — нов тест се добавя там, иначе няма да се изпълнява в GitHub. Два стража пазят това: `ci-workflow.test.js` проверява, че списъкът в CI е пълен и актуален, и че броят тестове в README съвпада с реалния.

## Как се добавя упражнение

1. **`data.js`:** нов ред в `exercises` с уникален `id`, имена `name`/`nameEn`/`nameDe`, `level`, `equip`, `muscles`, `prerequisites`, `steps`, `commonMistakes`, `easier`, `harder`, `progression`, `measure` и `defaultMetric` (`reps` или `seconds`). Ако няма снимка — използвай `pendingExercise(...)` като останалите без визуализация.
2. **Снимка:** `media/exercises/<id>-480.webp` (480×320) и `<id>-960.webp` (960×640), под 150 KB; ред в `exercise-photos.js` (`ids` + `get`); запис в `media/manifest.json` с `variants.mobile/desktop` (path, width, height, bytes, sha256) — тестовете смятат контролната сума.
3. **Превод:** ред в `exercise-translations.js` `[bg, en, de]`.
4. **Тестове:** `test.js` (изисквания към записа), `exercise-photos.test.js` ако има снимка.
5. **Нов файл с код?** Добави го в `index.html` **и** в `ASSETS` на `service-worker.js`, иначе липсва офлайн.

## Как се добавя храна

Аналогично: ред в `data.js` → `foods` (уникален `id`, `fdcId` и линкове към USDA, стойности за 100 г, `state`, `emoji`), после `food-photos.js`, `media/foods/` + манифест, `food-translations.js`.

## Как се добавя текст на интерфейса

1. В `interface-translations.js`: `'ns.key':['български','English','Deutsch']` — **една линия, трите езика**.
2. В `app.js`: `textFor('ns.key','Българският текст по подразбиране')`; в `index.html`: `data-i18n="ns.key"`.
3. `i18n-coverage.test.js` хваща липсващ, дублиран или неизползван ключ; `interface-translations.test.js` — еднакви променливи (`{count}` и т.н.) на трите езика.

## Как се пуска промяна (release checklist)

1. `node --test *.test.js` минава.
2. Новите тестове са в `.github/workflows/final-check.yml`.
3. Броят тестове в README е актуален (иначе `ci-workflow.test.js` пада).
4. Променяне на файл от `ASSETS` (напр. `app.js`, `core.js`, `interface-translations.js`)? → **ново име на кеша** в `service-worker.js` + съответната проверка в `pwa.test.js`, за да получат инсталираните PWA файловете.
5. Смяна на версията? → `index.html` (`shell.version`) и `interface-translations.js` (`shell.version`).
6. Документацията (README/QA/DEMO) отразява промяната; после PR → CI зелено → сливане в `main`; GitHub Pages публикува автоматично.

## Бележки за защитата

- **Няма сървър:** статични файлове на GitHub Pages; състоянието е в `localStorage` и се проверява при всяко стартиране (`state-normalizer.js`).
- **Таймерът наваксва по часовник:** използва `Date`, затова заключване на телефона или фонов режим не изместват отброяването.
- **Три езика без фреймворк:** `textFor(key, fallback)` → `locale-content.js` → таблиците с преводи; изборът се пази в `localStorage`.
- **Плеърът е достъпен:** всяка смяна на фаза се обявява през `aria-live` регион.
- **Сигурност на данните:** JSON архив (`backup.js`) с валидация при възстановяване; повредените стойности се поправят, а не сриват приложението.
