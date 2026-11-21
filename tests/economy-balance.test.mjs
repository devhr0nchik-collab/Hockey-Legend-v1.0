// ============================================================
// Этап 1.1 плейтест-плана: биржа — капы, формула капитализации,
// недельный лимит, миграция «космических» цен в loadGame.
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

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Биржа Тест';
    document.getElementById('ca-agency').value = 'Stock Agency';
    document.getElementById('ca-start').click();
});

describe('1.1 биржа: формула и капы', () => {
    it('стартовая цена = fair, история в коридоре', () => {
        const keys = window.__HL.clubKeysForTest();
        expect(keys.length).toBeGreaterThan(50);
        for (const k of keys) {
            const p = window.__HL.stockFairProbe(k);
            expect(p.price).toBe(p.fair);
            expect(p.floor).toBeLessThanOrEqual(p.price);
            expect(p.ceiling).toBeGreaterThanOrEqual(p.price);
        }
    });

    it('рост за 100 недель не превышает ~2.5x (любая лига)', () => {
        const keys = window.__HL.clubKeysForTest();
        const sample = [
            keys.find(k => k.startsWith('NHL_')),
            keys.find(k => k.startsWith('KHL_')),
            keys.find(k => k.startsWith('MHL_')),
            keys.find(k => k.startsWith('Belarus_Vysshaya_'))
        ].filter(Boolean);
        for (const k of sample) {
            const start = window.__HL.stockFairProbe(k).price;
            window.__HL.setSeed(1100 + sample.indexOf(k));
            const after = window.__HL.stockWeeksNow(k, 100);
            // 1.025^100 ≈ 11.8 математически, но потолок 1.5×fair и
            // коридор миграции не дают цене уйти дальше ~2.5x от старта.
            expect(after.price).toBeLessThanOrEqual(Math.round(start * 2.5));
            expect(after.price).toBeGreaterThanOrEqual(1);
        }
    });

    it('прокачка всех карточек до 25 даёт ≤ +25% к fair-цене', () => {
        const k = window.__HL.clubKeysForTest().find(x => x.startsWith('NHL_'));
        const before = window.__HL.stockFairProbe(k).fair;
        window.__HL.setClubUpgradesForTest(k, 25);
        const after = window.__HL.stockFairProbe(k).fair;
        expect(after).toBeLessThanOrEqual(Math.round(before * 1.25) + 1);
        expect(after).toBeGreaterThan(before);
    });

    it('недельный тик: цена в floor/ceiling и в пределах ±2.5%', () => {
        const k = window.__HL.clubKeysForTest().find(x => x.startsWith('KHL_'));
        window.__HL.setSeed(2200);
        for (let i = 0; i < 30; i++) {
            const before = window.__HL.stockFairProbe(k);
            const after = window.__HL.stockTickNow(k);
            expect(after.price).toBeGreaterThanOrEqual(before.floor);
            expect(after.price).toBeLessThanOrEqual(before.ceiling);
            expect(after.price).toBeGreaterThanOrEqual(Math.floor(before.price * 0.975));
            expect(after.price).toBeLessThanOrEqual(Math.ceil(before.price * 1.025));
        }
    });

    it('clampStockMove ограничивает движение ±2.5%', () => {
        expect(window.__HL.stockClampProbe(1000, 5000)).toBe(1025);
        expect(window.__HL.stockClampProbe(1000, 10)).toBe(975);
        expect(window.__HL.stockClampProbe(1000, 1010)).toBe(1010);
        expect(window.__HL.stockClampProbe(0, 500)).toBe(500);
    });

    it('абьюз «дешёвые апгрейды разгоняют цену» закрыт: +5000% невозможен', () => {
        const k = window.__HL.clubKeysForTest().find(x => x.startsWith('MHL_'));
        const start = window.__HL.stockFairProbe(k).price;
        window.__HL.setClubUpgradesForTest(k, 25);
        window.__HL.setSeed(3300);
        const after = window.__HL.stockWeeksNow(k, 3);
        expect(after.price).toBeLessThan(start * 1.2);
    });

    it('миграция: космическая цена сбрасывается к fair, история чистится', async () => {
        const k = window.__HL.clubKeysForTest().find(x => x.startsWith('NHL_'));
        const fair = window.__HL.stockFairProbe(k).fair;
        window.__HL.setClubStockForTest(k, {
            stockPrice: fair * 1000,
            stockHistory: [fair, fair * 500, fair * 2000, Math.round(fair * 1.1)]
        });
        await window.__HL.saveGame();
        await new Promise((r) => setTimeout(r, 100));
        const ok = await window.__HL.loadGame();
        expect(ok).toBe(true);

        const p = window.__HL.stockFairProbe(k);
        expect(p.price).toBe(p.fair);
        const hist = window.__HL.stockTickNow(k).history; // тик добавит ещё одну запись
        for (const v of hist) {
            expect(v).toBeGreaterThanOrEqual(Math.round(p.fair * 0.5));
            expect(v).toBeLessThanOrEqual(Math.round(p.fair * 2));
        }
        const news = JSON.parse(window.__HL.weekSnapshot()).news.map(n => n[0]);
        expect(news.some(t => t.includes('Рынок акций пересчитан'))).toBe(true);
    });

    it('один вызов simRandom на тик (детерминизм недели)', () => {
        const k = window.__HL.clubKeysForTest()[0];
        window.__HL.setSeed(4400);
        const d0 = window.__HL.mvDraws();
        window.__HL.stockTickNow(k);
        expect(window.__HL.mvDraws() - d0).toBe(1);
    });
});