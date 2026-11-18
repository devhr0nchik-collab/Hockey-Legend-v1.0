// ============================================================
// Детерминизм плей-офф: сетка, серии, чемпионы, призовые.
// Два прогона из одного и того же сейва должны совпасть полностью.
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
    document.getElementById('ca-name').value = 'Плей-офф Тест';
    document.getElementById('ca-agency').value = 'Cup Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Клиент Кубка');
    await window.__HL.saveGame();
    await new Promise((r) => setTimeout(r, 100));
    BASE_SAVE = JSON.stringify(window._lastSaveData);
});

async function runPlayoffRounds(count = 3) {
    const loaded = await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
    expect(loaded).toBe(true);

    window.__HL.startPlayoffsNow();
    const snapshots = [window.__HL.playoffSnapshot()];
    for (let i = 0; i < count; i++) {
        window.__HL.playoffTick();
        snapshots.push(window.__HL.playoffSnapshot());
    }
    return snapshots;
}

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

describe('плей-офф детерминирован', () => {
    it('раунд плей-офф не использует Math.random', async () => {
        await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
        window.__HL.startPlayoffsNow();
        let snap = '';
        const hits = captureMathRandom(() => {
            window.__HL.playoffTick();
            snap = window.__HL.playoffSnapshot();
        });
        expect(snap).toBeTruthy();
        expect(hits.slice(0, 8)).toEqual([]);
    });

    it('три раунда из одного сейва дают одинаковую сетку и чемпионов', async () => {
        const first = await runPlayoffRounds(3);
        const second = await runPlayoffRounds(3);

        expect(first.length).toBe(4);
        expect(second).toEqual(first);
    });

    it('плей-офф стартует для всех лиг и серии доходят до 4 побед', async () => {
        const snaps = await runPlayoffRounds(1);
        const state = JSON.parse(snaps[0]).state;
        const leagues = Object.keys(state);

        expect(leagues.length).toBeGreaterThan(5);
        for (const lk of leagues) {
            expect(state[lk].series.length).toBeGreaterThan(0);
        }

        const after = JSON.parse(snaps[1]).state;
        for (const lk of leagues) {
            for (const s of after[lk].series) {
                if (!s.winner) continue;
                const wins = Math.max(s.winsA, s.winsB);
                const losses = Math.min(s.winsA, s.winsB);
                expect(wins).toBe(4);
                expect(losses).toBeLessThan(4);
                expect(s.games.length).toBe(wins + losses);
                expect(s.winner.name).toBe(s.winsA > s.winsB ? s.teamA.name : s.teamB.name);
                for (const g of s.games) {
                    expect(g.a).not.toBe(g.b); // овертайм доигрывается
                    expect(g.a).toBeGreaterThanOrEqual(0);
                    expect(g.b).toBeGreaterThanOrEqual(0);
                }
            }
        }
    });
});

describe('межсезонье детерминировано', () => {
    async function runOffseason() {
        const loaded = await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
        expect(loaded).toBe(true);
        window.__HL.startPlayoffsNow();
        window.__HL.playoffTick();
        window.__HL.playoffTick();
        window.__HL.finishTournamentNow();
        return window.__HL.weekSnapshot();
    }

    it('finishTournament дважды из одного сейва даёт одинаковое состояние', async () => {
        const first = await runOffseason();
        const second = await runOffseason();
        if (second !== first) {
            const a = JSON.parse(first);
            const b = JSON.parse(second);
            const diffs = [];
            const walk = (x, y, path) => {
                if (diffs.length >= 12) return;
                if (x === y) return;
                if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) {
                    diffs.push(`${path}: ${JSON.stringify(x)} !== ${JSON.stringify(y)}`);
                    return;
                }
                const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
                for (const k of keys) {
                    if (diffs.length >= 12) return;
                    walk(x[k], y[k], path ? `${path}.${k}` : k);
                }
            };
            walk(a, b, '');
            console.log('OFFSEASON DIFF:', diffs);
        }
        expect(second).toBe(first);
    });

    it('межсезонье не использует Math.random', async () => {
        await window.__HL.importSaveData(JSON.parse(BASE_SAVE));
        window.__HL.startPlayoffsNow();
        window.__HL.playoffTick();
        let snap = '';
        const hits = captureMathRandom(() => {
            window.__HL.finishTournamentNow();
            snap = window.__HL.weekSnapshot();
        });
        expect(snap).toBeTruthy();
        expect(hits.slice(0, 8)).toEqual([]);
    });
});
