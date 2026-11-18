// ============================================================
// Детерминизм симуляции: RNG-сервис + матч.
// Одинаковые входы → одинаковый счёт, авторы голов, звёзды.
// ============================================================
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSimulationSeed, matchSeed, setSimulationSeed, simInt, simRandom } from '../src/core/sim-random';

describe('sim-random', () => {
    it('после seed последовательность воспроизводима', () => {
        setSimulationSeed(123);
        const a = [simRandom(), simInt(1, 10), simRandom()];
        setSimulationSeed(123);
        const b = [simRandom(), simInt(1, 10), simRandom()];
        expect(b).toEqual(a);
        expect(getSimulationSeed()).toBe(123);
    });

    it('разные seed дают разные последовательности', () => {
        setSimulationSeed(1);
        const a = [simRandom(), simRandom(), simRandom()];
        setSimulationSeed(2);
        const b = [simRandom(), simRandom(), simRandom()];
        expect(b).not.toEqual(a);
    });

    it('simInt в границах', () => {
        setSimulationSeed(7);
        for (let i = 0; i < 200; i++) {
            const v = simInt(3, 5);
            expect(v).toBeGreaterThanOrEqual(3);
            expect(v).toBeLessThanOrEqual(5);
        }
    });

    it('matchSeed стабилен и различает недели', () => {
        expect(matchSeed(['NHL', 'A', 'B', 2026, 5])).toBe(matchSeed(['NHL', 'A', 'B', 2026, 5]));
        expect(matchSeed(['NHL', 'A', 'B', 2026, 5])).not.toBe(matchSeed(['NHL', 'A', 'B', 2026, 6]));
    });
});

describe('матч детерминирован', () => {
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

        document.getElementById('btn-new-game').click();
        document.getElementById('ca-name').value = 'RNG Тест';
        document.getElementById('ca-start').click();
    });

    afterAll(() => {
        setSimulationSeed(1);
    });

    it('повторный расчёт того же матча даёт тот же результат', () => {
        const a = window.__HL.simulateMatch('NHL');
        const b = window.__HL.simulateMatch('NHL');

        expect(a.homeScore).toBe(b.homeScore);
        expect(a.awayScore).toBe(b.awayScore);
        expect(a.isOT).toBe(b.isOT);
        expect(a.isSO).toBe(b.isSO);
        expect(a.goals).toEqual(b.goals);
        expect(a.threeStars).toEqual(b.threeStars);
        expect(a.playerRatings.map((r) => r.name + r.rating))
            .toEqual(b.playerRatings.map((r) => r.name + r.rating));
    });

    it('счёт и события матча консистентны', () => {
        const m = window.__HL.simulateMatch('NHL');
        expect(m.homeScore).toBeGreaterThanOrEqual(0);
        expect(m.awayScore).toBeGreaterThanOrEqual(0);
        expect(m.homeScore).not.toBe(m.awayScore); // ничьих не бывает (ОТ/буллиты)
        expect(m.goals.filter((g) => g.team === 'home').length).toBe(m.homeScore);
        expect(m.goals.filter((g) => g.team === 'away').length).toBe(m.awayScore);
        for (const g of m.goals) {
            expect(g.minute).toBeGreaterThanOrEqual(1);
            expect(g.minute).toBeLessThanOrEqual(60);
            expect(g.period).toBe(g.minute <= 20 ? 1 : g.minute <= 40 ? 2 : 3);
            expect(g.scorer).toBeTruthy();
        }
        expect(m.threeStars.length).toBeLessThanOrEqual(3);
        expect(m.playerRatings.length).toBeLessThanOrEqual(6);
        for (const r of m.playerRatings) {
            expect(r.rating).toBeGreaterThanOrEqual(1);
            expect(r.rating).toBeLessThanOrEqual(10);
        }
    });
});
