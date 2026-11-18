// ============================================================
// Финальный тест: полный сезон дважды из одного сейва.
// Чемпионы, таблицы, статистика игроков и бюджеты должны совпасть.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
let BASE_SAVE = '';

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
    document.getElementById('ca-name').value = 'Сезон Тест';
    document.getElementById('ca-agency').value = 'Season Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Клиент Сезона');
    await window.__HL.saveGame();
    await new Promise((r) => setTimeout(r, 100));
    BASE_SAVE = JSON.stringify(window._lastSaveData);
});

async function playFullSeason(maxTicks = 90) {
    const loaded = await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
    expect(loaded).toBe(true);

    const startSeason = JSON.parse(window.__HL.seasonSnapshot()).season;
    let ticks = 0;
    while (ticks < maxTicks) {
        const snap = JSON.parse(window.__HL.seasonSnapshot());
        if (snap.season > startSeason && snap.phase === 'regular') break;
        window.__HL.playPhaseTick();
        ticks++;
    }
    const final = window.__HL.seasonSnapshot();
    const parsedFinal = JSON.parse(final);
    return {
        final,
        ticks,
        startSeason,
        endSeason: parsedFinal.season,
        phase: parsedFinal.phase,
        playedTournament: (parsedFinal.nationalHistory || []).length > 0
    };
}

describe('полный сезон детерминирован', () => {
    it('два прогона дают одинакового чемпиона, таблицы и статистику', async () => {
        const first = await playFullSeason();
        const second = await playFullSeason();

        expect(first.ticks).toBeGreaterThan(60);
        expect(second.ticks).toBe(first.ticks);
        expect(first.endSeason).toBe(first.startSeason + 1);
        expect(first.phase).toBe('regular');
        expect(first.playedTournament).toBe(true);

        const parsed = JSON.parse(first.final);
        expect(parsed.championsHistory).toBeTruthy();
        expect(Object.keys(parsed.championsHistory).length).toBeGreaterThan(5);

        if (second.final !== first.final) {
            const a = JSON.parse(first.final);
            const b = JSON.parse(second.final);
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
            console.log('SEASON DIFF:', diffs);
        }
        expect(second.final).toBe(first.final);
    }, 300000);
});
