// Батч 1: данные событий и первый президентский цикл.
// Проверяем то, что легко сломать контентом: 25+ событий, 2+ варианта,
// видимая цена, отложенные последствия и отсутствие «всё сразу хорошо».
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESIDENT_EVENTS, PRESIDENT_BRIEFS, PRESIDENT_STANCES } from '../src/features/president/events.js';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const STYLE_CSS = readFileSync(join(process.cwd(), 'style.css'), 'utf8');

describe('Батч 1: контент решений и событий', () => {
    it('25+ событий, у каждого 2–4 варианта и видимая цена', () => {
        expect(PRESIDENT_EVENTS.length).toBeGreaterThanOrEqual(25);
        for (const ev of PRESIDENT_EVENTS) {
            expect(ev.id).toBeTruthy();
            expect(ev.title).toBeTruthy();
            expect(ev.text).toBeTruthy();
            expect(ev.options.length).toBeGreaterThanOrEqual(2);
            expect(ev.options.length).toBeLessThanOrEqual(4);
            for (const opt of ev.options) {
                expect(opt.id).toBeTruthy();
                expect(opt.label).toBeTruthy();
                expect(typeof opt.cost).toBe('string');
                expect(opt.effects && typeof opt.effects === 'object').toBe(true);
            }
        }
    });

    it('у каждого события есть отложенное последствие хотя бы у одного варианта', () => {
        for (const ev of PRESIDENT_EVENTS) {
            expect(ev.options.some(o => o.delayed && o.delayed.weeks >= 1 && o.delayed.weeks <= 5)).toBe(true);
        }
    });

    it('у каждого брифинга есть 2+ варианта и хотя бы один бесплатный', () => {
        expect(PRESIDENT_BRIEFS.length).toBeGreaterThanOrEqual(8);
        for (const brief of PRESIDENT_BRIEFS) {
            expect(brief.options.length).toBeGreaterThanOrEqual(2);
            expect(brief.options.some(o => !o.effects || !o.effects.cash || o.effects.cash >= 0)).toBe(true);
            for (const opt of brief.options) {
                expect(typeof opt.cost).toBe('string');
                expect(opt.effects && typeof opt.effects === 'object').toBe(true);
            }
        }
    });

    it('курсы недели: 4 варианта, у каждого цена и множитель силы', () => {
        expect(PRESIDENT_STANCES.length).toBe(4);
        for (const s of PRESIDENT_STANCES) {
            expect(s.cost).toBeTruthy();
            expect(Number.isFinite(s.strengthMult)).toBe(true);
            expect(s.effects && typeof s.effects === 'object').toBe(true);
        }
    });

    it('нет варианта, который одновременно улучшает все ключевые шкалы', () => {
        const keys = ['cash', 'trust', 'fans', 'dressing', 'prestige'];
        for (const ev of PRESIDENT_EVENTS) {
            for (const opt of ev.options) {
                const e = opt.effects || {};
                const positives = keys.filter(k => (e[k] || 0) > 0).length;
                const negatives = keys.filter(k => (e[k] || 0) < 0).length;
                expect(positives === 5 && negatives === 0).toBe(false);
            }
        }
    });

    it('нет строго доминирующих вариантов (сразу + отложенно)', () => {
        const keys = ['cash', 'trust', 'fans', 'dressing', 'prestige', 'conflict'];
        const total = (opt) => {
            const r = {};
            const chance = opt.delayed?.chance ?? 1;
            for (const k of keys) r[k] = (opt.effects?.[k] || 0) + ((opt.delayed?.effects?.[k] || 0) * chance);
            return r;
        };
        const pools = [PRESIDENT_EVENTS, PRESIDENT_BRIEFS];
        for (const pool of pools) {
            for (const item of pool) {
                for (let i = 0; i < item.options.length; i++) {
                    for (let j = 0; j < item.options.length; j++) {
                        if (i === j) continue;
                        const a = total(item.options[i]);
                        const b = total(item.options[j]);
                        let ge = true;
                        let gt = false;
                        for (const k of keys) {
                            let av = a[k] || 0;
                            let bv = b[k] || 0;
                            if (k === 'cash') { av /= 100000; bv /= 100000; }
                            if (k === 'conflict') { av = -av; bv = -bv; }
                            if (av < bv) ge = false;
                            if (av > bv) gt = true;
                        }
                        expect(ge && gt, `${item.id}: ${item.options[i].id} dominates ${item.options[j].id}`).toBe(false);
                    }
                }
            }
        }
    });
});

describe('Батч 1: шрифты и кириллица', () => {
    it('в исходниках нет битых символов U+FFFD', () => {
        for (const text of [INDEX_HTML, STYLE_CSS, readFileSync(join(process.cwd(), 'script.js'), 'utf8')]) {
            expect(text.includes('\uFFFD')).toBe(false);
        }
    });

    it('HUD-шрифт имеет кириллический fallback', () => {
        expect(STYLE_CSS).toMatch(/--font-hud:[^;]*(Segoe UI|Noto Sans|Arial|system-ui)/);
    });
});

describe('Батч 1: первый цикл президента', () => {
    beforeAll(async () => {
        try { localStorage.setItem('hockeyLegendLang', 'ru'); } catch (e) {}
        window.matchMedia = window.matchMedia || ((query) => ({
            matches: false, media: query, onchange: null,
            addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
        }));
        const body = INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');
        await import('../i18n.js');
        await import('../datapack_rosters.js');
        await import('../src/features/president/events.js');
        await import('../script.js');
        await import('../datapack.js');
        document.getElementById('btn-new-game').click();
        document.getElementById('ca-name').value = 'Президент Тест';
        document.getElementById('ca-agency').value = 'President Agency';
        document.getElementById('ca-start').click();
    });

    it('первая неделя даёт 3 решения и не оставляет тупика', () => {
        const HL = window.__HL;
        expect(HL.presidentBecomeForTest('ICE_HL')).not.toBeNull();
        const week = HL.presidentWeekProbe();
        expect(week).not.toBeNull();
        expect(week.briefIds.length).toBe(3);
        expect(week.stance).toBeNull();
        expect(week.eventId).toBe('E00');
        expect(HL.presidentReadyProbe()).toBe(false);

        const brief = PRESIDENT_BRIEFS.find(b => week.briefIds.includes(b.id));
        expect(brief).toBeTruthy();
        const choice = brief.options.find(o => o.delayed) || brief.options.find(o => !o.effects?.cash || o.effects.cash >= 0);
        expect(choice).toBeTruthy();
        HL.presidentChooseForTest('economy', brief.id, choice.id, 'speech');
        expect(HL.presidentReadyProbe()).toBe(false);
        const res = HL.presidentApplyWeekForTest();
        expect(res.ok).toBe(true);
        expect(HL.presidentWeekProbe().ready).toBe(true);
        expect(HL.presidentWeekProbe().delayed.length).toBeGreaterThan(0);
    });

    it('UX: экран решений и дашборд рендерятся с ценой и «Почему?»', () => {
        const HL = window.__HL;
        const decisions = HL.presidentRenderProbe();
        expect(decisions).toContain('Курс недели');
        expect(decisions).toContain('Один брифинг из трёх');
        expect(decisions).toContain('Событие недели');
        expect(decisions).toContain('pdec-option');
        const overview = HL.presidentOverviewProbe();
        expect(overview).toContain('why-btn');
        expect(overview).toContain('data-why=');
        expect(overview).toContain('Решения недели');
        expect(document.querySelectorAll('#club-hub-content > *').length).toBeLessThanOrEqual(7);
    });

    it('решения фиксируются, отложенное поставлено в очередь', () => {
        const HL = window.__HL;
        const before = HL.presidentWeekProbe();
        expect(before.delayed.length).toBeGreaterThan(0);
        expect(before.decisions).toBeGreaterThanOrEqual(1);
        expect(before.log?.[0]?.brief).toBeTruthy();
    });
});
