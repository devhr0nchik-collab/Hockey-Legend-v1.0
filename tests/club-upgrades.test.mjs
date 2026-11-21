// ============================================================
// Этап 2.2: апгрейды клуба — единый LEAGUE_BUDGET и новая формула.
// Стоимость = 0.5% бюджета лиги * level^1.35, доля от бюджета в UI.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const LEAGUE_BUDGET = { NHL: 100000000, KHL: 30000000, MHL: 500000 };

beforeAll(async () => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
    }));

    const body = INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');

    localStorage.setItem('hockeyLegendLang', 'ru');
    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Апгрейды Тест';
    document.getElementById('ca-agency').value = 'Upgrade Agency';
    document.getElementById('ca-start').click();

    const key = window.__HL.clubKeysForTest().find(k => k.startsWith('NHL_'));
    window.__HL.setPresidentForTest(key, 60);
});

describe('2.2 Апгрейды клуба: формула', () => {
    it('clubUpgradeCost монотонна по уровню', () => {
        for (const lk of ['NHL', 'KHL', 'MHL']) {
            let prev = 0;
            for (let lvl = 1; lvl <= 25; lvl++) {
                const cost = window.__HL.clubUpgradeCostProbe(lk, lvl);
                expect(cost).toBeGreaterThanOrEqual(100);
                if (lvl > 1) expect(cost).toBeGreaterThan(prev);
                prev = cost;
            }
        }
    });

    it('стоимость lvl 1 — 0.5% годового бюджета (≥ 0.3%)', () => {
        for (const lk of Object.keys(LEAGUE_BUDGET)) {
            const cost = window.__HL.clubUpgradeCostProbe(lk, 1);
            expect(cost).toBe(Math.round(LEAGUE_BUDGET[lk] * 0.005));
            expect(cost).toBeGreaterThanOrEqual(Math.ceil(LEAGUE_BUDGET[lk] * 0.003));
        }
    });

    it('полная прокачка 6 карточек до 25 укладывается в разумный потолок', () => {
        for (const lk of Object.keys(LEAGUE_BUDGET)) {
            const total = window.__HL.clubUpgradeTotalProbe(lk, 25);
            // ~23.5 годовых бюджета NHL по формуле level^1.35 — потолок 25.
            expect(total).toBeGreaterThan(0);
            expect(total).toBeLessThanOrEqual(LEAGUE_BUDGET[lk] * 25);
        }
    });
});

describe('2.2 Апгрейды клуба: покупка и UI', () => {
    it('покупка списывает ровно стоимость и повышает уровень на 1', () => {
        const keys = window.__HL.clubKeysForTest();
        const key = keys.find(k => k.startsWith('KHL_')) || keys[0];
        window.__HL.setPresidentForTest(key, 60);
        window.__HL.setClubUpgradesForTest(key, 1);

        const cost = window.__HL.clubUpgradeCostProbe('KHL', 1);
        window.__HL.setClubStockForTest(key, { budget: cost });

        const res = window.__HL.purchaseClubUpgradeNow('stadium');
        expect(res.cost).toBe(cost);
        expect(res.levelAfter).toBe(res.level + 1);
        expect(res.budgetAfter).toBe(0);
    });

    it('карточка показывает стоимость в процентах от бюджета клуба', () => {
        const key = window.__HL.clubKeysForTest().find(k => k.startsWith('NHL_'));
        window.__HL.setPresidentForTest(key, 60);
        window.__HL.setClubUpgradesForTest(key, 1);
        window.__HL.setClubStockForTest(key, { budget: 25000000 });

        const share = window.__HL.clubUpgradeShareProbe(key);
        expect(share.cost).toBe(500000);
        expect(share.share).toBeCloseTo((500000 / 25000000) * 100, 5);

        const html = window.__HL.clubUpgradeCardHTMLForTest('stadium');
        expect(html).toContain('infra-cost-pct');
        expect(html).toContain('%');
    });
});
