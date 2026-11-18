# Hockey Legend

Симулятор хоккейного агента (PWA). Игра целиком работает в браузере, сейвы хранятся в IndexedDB.

## Требования

- Node.js LTS (уже добавлен в пользовательский `PATH`: `%LOCALAPPDATA%\nodejs`)
- npm (идёт вместе с Node)

## Команды

```powershell
npm install          # один раз
npm run dev          # dev-сервер http://localhost:5173
npm run build        # production-сборка в dist/
npm run preview      # проверить собранную версию (SW работает только здесь)
npm test             # smoke- и юнит-тесты (vitest + jsdom)
npm run typecheck    # tsc --noEmit по src/
```

> В PowerShell, если `npm` ругается на политику выполнения скриптов, используйте `npm.cmd`.

## Структура

```
index.html            разметка всех экранов
style.css             стили
script.js             ядро игры (постепенно разбирается на модули)
i18n.js               словари RU/EN + перевод DOM (техдолг, план — ключи)
datapack_rosters.js   реальные составы
datapack.js           переименования клубов, логотипы, миграции сейва
public/               статика как есть: sw.js, icon.svg, manifest
src/main.ts           точка входа Vite (порядок: i18n → rosters → script → datapack)
src/core/             типизированное чистое ядро (rng, атрибуты, зарплаты, упаковка сейва)
tests/                vitest: smoke (jsdom) + юнит-тесты ядра
```

## Правила разработки

1. **Сейв-совместимость.** `SAVE_KEY = 'hockeyLegendSave_v23'`. Формат `packPlayer` (33 поля) и `packClub` (17 полей) меняется только добавлением в конец. Старые сейвы должны загружаться.
2. **Детерминизм.** Игровая симуляция обязана воспроизводиться по seed (`src/core/rng.ts`). `Math.random()` — только для косметики (анимации, снежинки).
3. **Миграция без изменения поведения.** Код переносится из `script.js` в `src/` кусками; монолит уменьшается в том же коммите. Новые фичи — отдельно.
4. **Связи с legacy.** `i18n.js` и `datapack.js` не импортируют `script.js` (циклы). Они общаются через узкие window-хуки: `window.onLanguageChanged`, `window.__teamLogoRenderer`, `window.getFarmClubOverride`.
5. **Проверка.** Перед коммитом: `npm test` и `npm run build`.

## План миграции (поэтапно)

- [x] Фаза 0. git, baseline, Node
- [x] Фаза 1. Vite + ESM-модули, SW только в prod, smoke-тесты
- [x] Фаза 2. Модель и сейвы: `types.ts`, `core/pack.ts`, `features/save/storage.ts`, `features/save/migrations.ts`, roundtrip-тест сейва на fake-indexeddb
- [ ] Фаза 2.5. Вынести `saveGame`/`loadGame` из `script.js` (требует единого state-объекта — делается вместе с Фазой 3)
- [~] Фаза 3. Детерминизм: `core/sim-random.ts` + seeded RNG в симуляции матча (готово). Осталось: перевести остальные `Math.random` (недельная симуляция, экономика, события) и вынести match/league/economy в `features/sim/`
- [ ] Фаза 3. Симуляция: RNG-сервис вместо `Math.random`, модули match/league/economy/draft/playoffs
- [ ] Фаза 4. i18n на ключи, удаление regex-слоя и MutationObserver
- [ ] Фаза 5. UI-экраны по одному: шаблоны + экранирование вместо `innerHTML`
