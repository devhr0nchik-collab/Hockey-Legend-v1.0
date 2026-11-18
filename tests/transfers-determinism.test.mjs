// ============================================================
// Детерминизм трансферного блока: оффер клуба, продление,
// желание уйти, пакет предложений и переговорный раунд.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
let BASE_SAVE = '';

function captureMathRandom(run) {
    const original = Math.random;
    const hits = [];
    Math.random = function patchedRandom() {
        hits.push((new Error().stack || '').split('\n').slice(2, 4).join(' | '));
        return original();
    };
    try {
        run();
    } finally {
        Math.random = original;
    }
    return hits;
}

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

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Трансфер Тест';
    document.getElementById('ca-agency').value = 'Transfer Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Клиент Трансфера');
    await window.__HL.saveGame();
    await new Promise((r) => setTimeout(r, 100));
    BASE_SAVE = JSON.stringify(window._lastSaveData);
});

describe('трансферы детерминированы', () => {
    it('оффер/продление/уход/пакет предложений воспроизводимы', async () => {
        await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
        const first = window.__HL.transferProbe();

        await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
        const second = window.__HL.transferProbe();

        expect(first.length).toBeGreaterThan(50);
        if (second !== first) {
            const a = JSON.parse(first);
            const b = JSON.parse(second);
            const diffs = [];
            const walk = (x, y, path) => {
                if (diffs.length >= 10) return;
                if (x === y) return;
                if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) {
                    diffs.push(`${path}: ${JSON.stringify(x)} !== ${JSON.stringify(y)}`);
                    return;
                }
                for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], path ? `${path}.${k}` : k);
            };
            walk(a, b, '');
            console.log('TRANSFER DIFF:', diffs);
        }
        expect(second).toBe(first);
    });

    it('трансферный блок не использует Math.random', async () => {
        await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
        let probe = '';
        const hits = captureMathRandom(() => {
            probe = window.__HL.transferProbe();
        });
        expect(probe).toBeTruthy();
        expect(hits.slice(0, 8)).toEqual([]);
    });
});
