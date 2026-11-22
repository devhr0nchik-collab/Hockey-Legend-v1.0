// ============================================================
// Батч 3: эффект бывшего клиента, миграция presidentState,
// детерминизм и локализация новых модулей.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateAttributes } from '../src/core/attributes';
import { PRESIDENT_EN } from '../src/features/president/events-i18n.js';
import { PRESIDENT_EVENTS, PRESIDENT_BRIEFS, PRESIDENT_STANCES } from '../src/features/president/events.js';
import { LANG } from '../i18n.js';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

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
    document.getElementById('ca-name').value = 'Батч Три';
    document.getElementById('ca-agency').value = 'Batch Three Agency';
    document.getElementById('ca-start').click();
});

describe('Пункт 9: бывший клиент — скидка, риск и лимиты', () => {
    it('сделка измерима: рыночная цена, скидка, экономия и риск', () => {
        const HL = window.__HL;
        for (let i = 1; i <= 6; i++) HL.addClient('Бывший Клиент ' + i);
        expect(HL.presidentBecomeForTest('ICE_HL')).not.toBeNull();
        const deal = HL.formerClientDealProbe();
        expect(deal).toBeTruthy();
        expect(deal.discountPct).toBeGreaterThanOrEqual(15);
        expect(deal.discountPct).toBeLessThanOrEqual(35);
        expect(deal.fee).toBeLessThan(deal.marketFee);
        expect(deal.savings).toBe(deal.marketFee - deal.fee);
        expect(deal.risk).toBeGreaterThan(0);
        expect(deal.seasonLeft).toBe(2);
        expect(deal.termLeft).toBe(4);
    });

    it('строго 2 подписания за сезон и 4 за срок', () => {
        const HL = window.__HL;
        const first = HL.formerClientSignNow();
        const second = HL.formerClientSignNow();
        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        expect(HL.formerClientLimitsProbe().seasonCount).toBe(2);
        const third = HL.formerClientSignNow();
        expect(third.ok).toBe(false);
        expect(third.reason).toContain('сезон');

        // Новый сезон сбрасывает только сезонный счётчик.
        HL.setWorldClockForTest(2027, 1);
        const limits = HL.formerClientLimitsProbe();
        expect(limits.seasonCount).toBe(0);
        expect(limits.termCount).toBe(2);

        expect(HL.formerClientSignNow().ok).toBe(true);
        expect(HL.formerClientSignNow().ok).toBe(true);
        expect(HL.formerClientLimitsProbe().termCount).toBe(4);
        // В следующем сезоне сезонный лимит снова 0, но срок уже исчерпан.
        HL.setWorldClockForTest(2028, 1);
        expect(HL.formerClientLimitsProbe().seasonCount).toBe(0);
        const overTerm = HL.formerClientSignNow();
        expect(overTerm.ok).toBe(false);
        expect(overTerm.reason).toContain('срок');
    });
});

describe('Пункт 11: старые сейвы получают безопасные defaults', () => {
    it('presidentState без clubKey не теряет шкалы, лог и отложенные эффекты', async () => {
        const HL = window.__HL;
        HL.saveGame();
        const base = JSON.parse(JSON.stringify(window._lastSaveData));
        const key = HL.presidentStateProbe().clubKey;
        const legacy = JSON.parse(JSON.stringify(base));
        legacy.presidentClubKey = key;
        legacy.presidentState = {
            ...base.presidentDecisions,
            meters: { fans: 77, dressing: 66 },
            log: [{ season: 2026, week: 1, brief: 'B', choice: 'C' }],
            delayed: [{ id: 'd1', due: 999999, title: 'T', text: 'X', effects: { fans: 1 } }],
            formerClients: ['Бывший Клиент 1'],
            formerClientSignings: { season: 2026, seasonCount: 1, termStartSeason: 2026, termCount: 2 }
        };
        delete legacy.presidentState.clubKey;
        delete legacy.presidentDecisions;

        expect(await HL.importSaveData(legacy)).toBe(true);
        const st = HL.presidentStateProbe();
        expect(st).toBeTruthy();
        expect(st.clubKey).toBe(key);
        expect(st.meters.fans).toBe(77);
        expect(st.meters.dressing).toBe(66);
        expect(st.log.length).toBe(1);
        expect(st.delayed.length).toBe(1);
        expect(st.formerClients).toContain('Бывший Клиент 1');
        expect(st.formerClientSignings.seasonCount).toBe(1);
        expect(st.formerClientSignings.termCount).toBe(2);
    });

    it('сейв без presidentState получает default для действующего клуба', async () => {
        const HL = window.__HL;
        HL.saveGame();
        const base = JSON.parse(JSON.stringify(window._lastSaveData));
        const key = base.presidentClubKey;
        const legacy = JSON.parse(JSON.stringify(base));
        delete legacy.presidentDecisions;
        delete legacy.presidentState;

        expect(await HL.importSaveData(legacy)).toBe(true);
        const st = HL.presidentStateProbe();
        expect(st).toBeTruthy();
        expect(st.clubKey).toBe(key);
        expect(st.meters.fans).toBeGreaterThan(0);
        expect(st.meters.dressing).toBe(55);
    });
});

describe('Пункт 12: детерминизм симуляции', () => {
    it('атрибуты без имени воспроизводимы (нет Math.random)', () => {
        expect(generateAttributes('C', 70)).toEqual(generateAttributes('C', 70));
        expect(generateAttributes('G', 82, 'Вратарь')).toEqual(generateAttributes('G', 82, 'Вратарь'));
    });
});

describe('Пункт 15: локализация новых модулей событий', () => {
    it('каждая строка событий/брифингов/курсов имеет EN-перевод', () => {
        const keys = new Set();
        const add = (s) => { if (typeof s === 'string' && s) keys.add(s); };
        const collect = (item) => {
            add(item.title); add(item.text); add(item.label); add(item.desc); add(item.cost);
            if (item.delayed) { add(item.delayed.title); add(item.delayed.text); }
            (item.options || []).forEach(opt => {
                add(opt.label); add(opt.desc); add(opt.cost);
                if (opt.delayed) { add(opt.delayed.title); add(opt.delayed.text); }
            });
        };
        PRESIDENT_EVENTS.forEach(collect);
        PRESIDENT_BRIEFS.forEach(collect);
        PRESIDENT_STANCES.forEach(collect);
        const missing = [...keys]
            .filter(k => /[А-Яа-яЁё]/.test(k))
            .filter(k => !PRESIDENT_EN[k]);
        expect(missing).toEqual([]);
        for (const key of keys) {
            if (!/[А-Яа-яЁё]/.test(key)) continue;
            expect(PRESIDENT_EN[key]).not.toMatch(/[А-Яа-яЁё]/);
        }
    });

    it('LANG переводит заголовок и текст события на EN', () => {
        const ev = PRESIDENT_EVENTS[0];
        const prev = LANG.current;
        try {
            LANG.set('en');
            expect(LANG.t(ev.title)).not.toMatch(/[А-Яа-яЁё]/);
            expect(LANG.t(ev.text)).not.toMatch(/[А-Яа-яЁё]/);
            expect(LANG.t('Решения недели')).not.toMatch(/[А-Яа-яЁё]/);
        } finally {
            LANG.set(prev);
        }
    });
});
