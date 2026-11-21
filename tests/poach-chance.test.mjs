// ============================================================
// Этап 2.3: переманивание — чистый шанс, качество оффера, пресеты.
// Шанс зависит только от входов и seed, без жёстких потолков.
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

    localStorage.setItem('hockeyLegendLang', 'ru');
    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Интриги Тест';
    document.getElementById('ca-agency').value = 'Poach Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Целевой Игрок');
    window.__HL.setPlayerContract('Целевой Игрок', { rating: 75, loyalty: 100, age: 22 });
});

describe('2.3 Переманивание: качество оффера и пресеты', () => {
    it('три пресета с разной ценой и качеством', () => {
        const presets = window.__HL.poachPresetsProbe('Целевой Игрок');
        expect(presets.map(p => p.id)).toEqual(['standard', 'star', 'media']);

        const byId = Object.fromEntries(presets.map(p => [p.id, p]));
        expect(byId.star.quality).toBeGreaterThan(byId.media.quality);
        expect(byId.media.quality).toBeGreaterThan(byId.standard.quality);
        expect(byId.star.cost).toBeGreaterThan(byId.standard.cost);
        expect(byId.standard.cost).toBe(0);
    });

    it('качество растёт с зарплатой и падает с комиссией', () => {
        const name = 'Целевой Игрок';
        const low = window.__HL.poachOfferQualityProbe(name, {
            newSalary: 100, agentCommissionRate: 0.20, signingBonus: 0, promises: []
        });
        const high = window.__HL.poachOfferQualityProbe(name, {
            newSalary: 5000, agentCommissionRate: 0.03, signingBonus: 1000000, promises: ['nhl', 'star']
        });
        const expensive = window.__HL.poachOfferQualityProbe(name, {
            newSalary: 5000, agentCommissionRate: 0.20, signingBonus: 0, promises: []
        });
        expect(high).toBeGreaterThan(low);
        expect(high).toBeGreaterThan(expensive);
        expect(high).toBeLessThanOrEqual(1);
    });
});

describe('2.3 Переманивание: чистый шанс', () => {
    it('шанс монотонно растёт с репутацией', () => {
        const values = [10, 30, 50, 70, 90, 110].map(rep =>
            window.__HL.poachChanceProbe('Целевой Игрок', 95, 'correct', 'star', rep)
        );
        for (let i = 1; i < values.length; i++) {
            expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
        }
    });

    it('шанс монотонно растёт с quality', () => {
        const lo = window.__HL.poachChanceProbe('Целевой Игрок', 50, 'neutral', { quality: 0 }, 60);
        const mid = window.__HL.poachChanceProbe('Целевой Игрок', 50, 'neutral', { quality: 0.5 }, 60);
        const hi = window.__HL.poachChanceProbe('Целевой Игрок', 50, 'neutral', { quality: 1 }, 60);
        expect(mid).toBeGreaterThan(lo);
        expect(hi).toBeGreaterThan(mid);
    });

    it('max rep + лучший оффер + верная реплика ≥ 45% (цель 45–55%)', () => {
        const chance = window.__HL.poachChanceProbe('Целевой Игрок', 95, 'correct', 'star', 100);
        expect(chance).toBeGreaterThanOrEqual(45);
        expect(chance).toBeLessThanOrEqual(55);
    });

    it('min rep + неверная реплика ≤ 15%', () => {
        const chance = window.__HL.poachChanceProbe('Целевой Игрок', 95, 'wrong', 'standard', 3);
        expect(chance).toBeLessThanOrEqual(15);
    });

    it('частные случаи: рейтинг 80+ при rep<20 и разрыв топ-агентства', () => {
        window.__HL.setPlayerContract('Целевой Игрок', { rating: 85 });
        expect(window.__HL.poachChanceProbe('Целевой Игрок', 50, 'correct', 'star', 5)).toBe(5);
        expect(window.__HL.poachChanceProbe('Целевой Игрок', 95, 'neutral', 'star', 20)).toBeLessThanOrEqual(10);
    });

    it('шанс всегда в [5, 85] и не NaN без оффера', () => {
        const replies = ['correct', 'neutral', 'wrong'];
        for (const rep of [3, 50, 100]) {
            for (const agencyRep of [15, 60, 95]) {
                for (const reply of replies) {
                    for (const preset of ['standard', 'star', 'media']) {
                        const chance = window.__HL.poachChanceProbe('Целевой Игрок', agencyRep, reply, preset, rep);
                        expect(Number.isFinite(chance)).toBe(true);
                        expect(chance).toBeGreaterThanOrEqual(5);
                        expect(chance).toBeLessThanOrEqual(85);
                        expect(Number.isInteger(chance)).toBe(true);
                    }
                }
            }
        }
        const noOffer = window.__HL.poachChanceRawProbe('Целевой Игрок', 95, 'neutral', null, 50);
        expect(Number.isFinite(noOffer)).toBe(true);
        expect(noOffer).toBeGreaterThanOrEqual(5);
    });

    it('детерминизм: шанс и бросок зависят только от входов и seed', () => {
        const a = window.__HL.poachChanceProbe('Целевой Игрок', 80, 'correct', 'media', 75);
        const b = window.__HL.poachChanceProbe('Целевой Игрок', 80, 'correct', 'media', 75);
        expect(a).toBe(b);

        window.__HL.setSeed(4242);
        const r1 = window.__HL.poachRollProbe(a);
        window.__HL.setSeed(4242);
        const r2 = window.__HL.poachRollProbe(a);
        expect(r1).toBe(r2);
    });
});
