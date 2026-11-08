## Промяна

Какво се променя и защо.

## Проверки

- [ ] `node --test *.test.js` минава локално
- [ ] Новите или променените тестове са добавени в `.github/workflows/final-check.yml`
- [ ] Ако са добавяни тестове — броят в README е актуален (`ci-workflow.test.js` го проверява)
- [ ] Ако са променяни файлове, които service worker кешира — ново име на кеша в `service-worker.js` и `pwa.test.js`
- [ ] Ако се сменя версията — `index.html` (`shell.version`) и `interface-translations.js` (`shell.version`)
- [ ] Документацията (README / QA / DEMO) отразява промяната
