// ============================================================
// Батч 2: экономика, баланс тактик, оценка сезона, warm-up,
// потолок кассы и конкурентный ИИ-мир.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    CLUB_TACTICS, TACTIC_IDS, runTacticsMonteCarlo,
    gradeSeason, computeNextSeasonBudget, cashCapForRevenue
} from '../src/features/economy/balance.js';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const HL = () => window.__HL;
let LANG = null;

beforeAll(async () => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
    }));

    const body = INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');

    const i18n = await import('../i18n.js');
    LANG = i18n.LANG;
    LANG.set('ru');
    await import('../datapack_rosters.js');
    await import('../src/features/president/events.js');
    await import('../script.js');
    await import('../datapack.js');

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Баланс Тест';
    document.getElementById('ca-agency').value = 'Balance Agency';
    document.getElementById('ca-start').click();
});

describe('Пункт 4: нет доминирующей тактики', () => {
    it('Monte Carlo: ни одна тактика не даёт больше 70% побед', () => {
        const results = runTacticsMonteCarlo(2000);
        expect(results).toHaveLength(TACTIC_IDS.length);
        for (const row of results) {
            expect(row.samples).toBe(2000);
            expect(row.winRate).toBeLessThanOrEqual(70);
            expect(row.winRate).toBeGreaterThan(20);
        }
        // Тактики должны отличаться, а не быть копией одной.
        expect(new Set(results.map(r => r.winRate)).size).toBeGreaterThan(1);
        expect(runTacticsMonteCarlo(2000)).toEqual(results);
    });

    it('интеграция: курс президента превращается в тактику матча', () => {
        const p = HL().presidentBecomeForTest('ICE_HL');
        expect(p).not.toBeNull();
        HL().presidentChooseForTest('result', null, null, null);
        const probe = HL().presidentTacticProbe();
        expect(probe.stance).toBe('result');
        expect(probe.tactic.id).toBe('attack');
        expect(probe.tactic.attack).toBe(CLUB_TACTICS.attack.attack);
        HL().presidentChooseForTest(null, null, null, null);
        expect(HL().presidentTacticProbe().tactic.id).toBe('balanced');
    });
});

describe('Пункт 3: замкнутый контур экономики', () => {
    it('деньги → штат → сила и деньги → трансферы → сила', () => {
        const p = HL().presidentBecomeForTest('ICE_HL');
        const key = p.key;
        const beforeStrength = HL().clubStrengthProbe('ICE_HL', p.club);
        HL().setClubStockForTest(key, { budget: 100000000 });
        const buy = HL().purchaseClubUpgradeNow('training');
        expect(buy.levelAfter).toBeGreaterThan(buy.level);
        expect(buy.budgetAfter).toBeLessThan(buy.budget);
        HL().setClubUpgradesForTest(key, 25);
        HL().refreshStrengthsNow();
        const afterStrength = HL().clubStrengthProbe('ICE_HL', p.club);
        expect(afterStrength).toBeGreaterThan(beforeStrength);
    });

    it('результат → форма/фанаты → выручка', () => {
        const keys = HL().clubKeysForTest();
        const aiKey = keys.find(k => k.startsWith('NHL_'));
        const lk = aiKey.split('_')[0];
        const club = aiKey.slice(lk.length + 1);

        HL().setClubFormForTest(aiKey, ['W', 'W', 'W', 'W', 'W']);
        const goodFans = HL().clubFanbaseProbe(lk, club);
        const goodIncome = HL().economyTickNow(aiKey).income;

        HL().setClubFormForTest(aiKey, ['L', 'L', 'L', 'L', 'L']);
        const badFans = HL().clubFanbaseProbe(lk, club);
        const badIncome = HL().economyTickNow(aiKey).income;

        expect(goodFans).toBeGreaterThan(badFans);
        expect(goodIncome).toBeGreaterThan(badIncome);

        // Результат президентского матча двигает шкалу фанатов.
        const p = HL().presidentBecomeForTest('ICE_HL');
        const before = HL().presidentWeekProbe().meters.fans;
        const r = HL().applyResultForTest('ICE_HL', p.club, 'Соперник', 4, 1);
        expect(r.presidentFans).toBe(Math.min(100, before + 1));
    });
});

describe('Пункт 6: оценка сезона и бюджет', () => {
    it('грейд считается по месту, задачам и финансам', () => {
        const s = gradeSeason({ place: 1, totalTeams: 12, tasksDone: 3, tasksTotal: 3, revenue: 10000000, expenses: 6000000, champion: true });
        const f = gradeSeason({ place: 12, totalTeams: 12, tasksDone: 0, tasksTotal: 3, revenue: 10000000, expenses: 14000000 });
        expect(['S', 'A']).toContain(s.grade);
        expect(['D', 'F']).toContain(f.grade);
        expect(s.score).toBeGreaterThan(f.score);
    });

    it('конкретный бюджет на следующий сезон и потолок 2× выручки', () => {
        const revenue = 12000000;
        const budget = computeNextSeasonBudget({ revenue, currentBudget: 4000000, leagueBudget: 20000000, grade: 'A' });
        expect(budget).toBeGreaterThan(0);
        expect(budget).toBeLessThanOrEqual(cashCapForRevenue(revenue));
        const cap = cashCapForRevenue(revenue);
        expect(cap).toBe(revenue * 2);
    });

    it('интеграция: отзыв сохраняется и показывается в обзоре клуба', () => {
        const p = HL().presidentBecomeForTest('ICE_HL');
        const season = HL().getState().currentSeason - 1;
        HL().setClubSeasonPlaceForTest(p.key, season, 1, 20);
        const council = HL().councilState().clubCouncil;
        council.tasks.forEach(t => { t.done = true; });
        const review = HL().seasonReviewNow(p.key, season, council);
        expect(review).not.toBeNull();
        expect(review.grade).toBeTruthy();
        expect(review.budgetNext).toBeGreaterThan(0);
        expect(HL().seasonReviewProbe(p.key).latest.budgetNext).toBe(review.budgetNext);
        const overview = HL().presidentOverviewProbe();
        expect(overview).toContain('Оценка сезона');
        expect(overview).toContain('Бюджет на следующий сезон');
    });
});

describe('Пункт 10: экономика не разгоняется', () => {
    it('за 5 сезонов касса не превышает 2× выручки', () => {
        const key = HL().clubKeysForTest().find(k => k.startsWith('NHL_'));
        const cap = HL().clubCashCapProbe(key);
        HL().setClubBudgetForTest(key, cap * 5);
        const capped = HL().enforceCashCapNow(key);
        expect(capped.capped).toBe(true);
        expect(capped.excess).toBeGreaterThan(0);
        expect(HL().economyProbe(key).budget).toBeLessThanOrEqual(cap);

        HL().setSeed(5150);
        const after = HL().economySeasonsNow(key, 5);
        expect(after.budget).toBeGreaterThanOrEqual(0);
        expect(after.budget).toBeLessThanOrEqual(after.cashCap);
    });

    it('решение совета может временно разрешить кассу выше потолка', () => {
        const key = HL().clubKeysForTest().find(k => k.startsWith('KHL_'));
        const cap = HL().clubCashCapProbe(key);
        HL().setClubBudgetForTest(key, cap * 3);
        HL().approveCashCapNow(key, 1);
        HL().enforceCashCapNow(key);
        expect(HL().economyProbe(key).budget).toBeGreaterThan(cap);
    });
});

describe('Пункт 7: обратимое увольнение', () => {
    it('увольнение возвращает в агентство, сохраняет капитал и даёт warm-up 2–8 недель', () => {
        const p = HL().presidentBecomeForTest('ICE_HL');
        const moneyBefore = HL().getState().agentMoney;
        const cs = HL().councilState();
        HL().patchCouncilForTest({
            failsStreak: 2,
            tasks: cs.clubCouncil.tasks.map(t => ({ ...t, done: false }))
        });
        HL().setPhaseForTest('transfer_off', 1);
        HL().setSeed(707);
        HL().playPhaseTick();

        const after = HL().presidentWarmupProbe();
        expect(after.presidentClubKey).toBeNull();
        expect(after.warmup.weeks).toBeGreaterThanOrEqual(2);
        expect(after.warmup.weeks).toBeLessThanOrEqual(8);
        expect(after.weeksLeft).toBeGreaterThanOrEqual(2);
        expect(after.weeksLeft).toBeLessThanOrEqual(8);
        expect(after.warmup.clubKey).toBe(p.key);
        expect(after.hasPortfolio).toBe(true);
        // Увольнение не штрафует капитал: списываются только обычные недельные расходы.
        expect(HL().getState().agentMoney).toBeGreaterThanOrEqual(moneyBefore - 5000);
    });

    it('warm-up переживает save → load', async () => {
        await HL().saveGame();
        await new Promise((r) => setTimeout(r, 100));
        const before = HL().presidentWarmupProbe();
        const ok = await HL().loadGame();
        expect(ok).toBe(true);
        const after = HL().presidentWarmupProbe();
        expect(after.warmup).toEqual(before.warmup);
        expect(after.weeksLeft).toBe(before.weeksLeft);
    });
});

describe('Пункт 14: ИИ-мир остаётся конкурентным', () => {
    it('ИИ-клубы усиливаются за деньги, президентский клуб не получает автобонус', () => {
        const clubName = HL().leagueClubsProbe('ICE_HL')[0];
        const beforeEff = HL().worldStrengthProbe('ICE_HL', clubName).effective;
        const p = HL().presidentBecomeForTest('ICE_HL', clubName);
        const res = HL().aiUpgradesNow(9091);
        expect(res.total).toBeGreaterThan(0);
        expect(res.changed.some(c => c.key !== p.key)).toBe(true);
        expect(res.changed.every(c => c.key !== p.key)).toBe(true);
        for (const c of res.changed) {
            expect(c.after).toBeGreaterThan(c.before);
            expect(c.budgetAfter).toBeLessThanOrEqual(c.budgetBefore);
        }

        // Без выбранного курса президентский клуб не имеет скрытого преимущества.
        HL().presidentChooseForTest(null, null, null, null);
        const afterEff = HL().worldStrengthProbe('ICE_HL', clubName).effective;
        expect(afterEff).toBe(beforeEff);
    });

    it('тактики ИИ-мира не ломают баланс: 4 тактики, запас по винрейту', () => {
        const rows = HL().tacticsMonteCarlo(1500);
        expect(rows).toHaveLength(4);
        const max = Math.max(...rows.map(r => r.winRate));
        const min = Math.min(...rows.map(r => r.winRate));
        expect(max).toBeLessThanOrEqual(70);
        expect(max - min).toBeGreaterThan(1);
    });
});
