// ============================================================
// Детерминизм недели: один и тот же сейв + неделя → одинаковое
// состояние после тика (таблицы, деньги, статистика, новости).
//
// Тест намеренно ловит любые вызовы Math.random во время тика:
// если что-то в недельной симуляции осталось недетерминированным,
// тест покажет файл и строку виновника.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

beforeAll(async () => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
    }));

    const body = INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');

    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');

    // Новая игра + один клиент в ростере (иначе недельная симуляция клиентов не запускается)
    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Неделя Тест';
    document.getElementById('ca-agency').value = 'Week Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Клиент Недели');
    await window.__HL.saveGame();
    await new Promise((r) => setTimeout(r, 100));
});

function captureMathRandom(run) {
    const original = Math.random;
    const hits = [];
    Math.random = function patchedRandom() {
        const stack = (new Error().stack || '').split('\n').slice(2, 4).join(' | ');
        hits.push(stack);
        return original();
    };
    try {
        run();
    } finally {
        Math.random = original;
    }
    return hits;
}

describe('неделя детерминирована', () => {
    async function restoreWeekOne() {
        window.__HL.resetGame();
        const ok = await window.__HL.loadGame();
        expect(ok).toBe(true);
    }

    it('тик недели не использует Math.random', async () => {
        await restoreWeekOne();
        let snapshot = '';
        const hits = captureMathRandom(() => {
            window.__HL.advanceWeek();
            snapshot = window.__HL.weekSnapshot();
        });
        expect(snapshot).toBeTruthy();
        // Если упало — в сообщении будут конкретные места вызова.
        expect(hits.slice(0, 8)).toEqual([]);
    });

    it('reset → load → тот же тик даёт то же состояние', async () => {
        await restoreWeekOne();
        const first = window.__HL.advanceWeek();

        await restoreWeekOne();
        const second = window.__HL.advanceWeek();

        expect(second).toBe(first);
    });
});
