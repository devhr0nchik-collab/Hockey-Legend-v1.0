# Hockey Legend

- Игра: Hockey Legend — симулятор хоккейного агента (PWA).
- Стек: JavaScript (ESM) + TypeScript, Node.js, Vite, Vitest, jsdom, IndexedDB.

## Команды

- `npm test` — все тесты Vitest.
- `npm run typecheck` — проверка типов (`tsc --noEmit`).
- `npm run build` — production-сборка Vite.

## Правила

- Симуляция детерминирована по seed: одинаковый сейв и тик дают одинаковое состояние.
- Игровая случайность — только через seeded-RNG (`src/core/sim-random.ts`).
- `Math.random()`/`Date.now()`/локаль-зависимое форматирование не влияют на состояние игры.
