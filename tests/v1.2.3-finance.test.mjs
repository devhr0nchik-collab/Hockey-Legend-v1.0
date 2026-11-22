// ============================================================
// v1.2.3: шанс подписания в конструкторе контракта и финансовая
// история агентства (лог операций, лимит 100, save/load).
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const STYLE_CSS = readFileSync(join(process.cwd(), 'style.css'), 'utf8');
const PLAYER = 'Finance Test Player';

const OFFER = {
    club: 'Finance Test Club', league: 'NHL', prestige: 85,
    newSalary: 2500, years: 3, signingBonus: 0, agentCommissionRate: 0.10,
    goalBonus: 500, assistBonus: 300, cleanSheetBonus: 0, savesBonus: 0, gamesPlayedBonus: 0,
    guaranteedYears: 1, clubBudget: 100000000, trueInterest: 4, interest: 6, acceptChance: 80
};

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
    document.getElementById('ca-name').value = 'Finance Agent';
    document.getElementById('ca-agency').value = 'Finance Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient(PLAYER);
});

const HL = () => window.__HL;

describe('v1.2.3: шанс подписания', () => {
    it('процент в DOM пересчитывается при input на ползунке зарплаты', () => {
        HL().openDialogueWithOffer(PLAYER, { ...OFFER });
        const slider = document.getElementById('neg-range-newSalary');
        const chance = document.getElementById('neg-chance');
        expect(slider).toBeTruthy();
        expect(chance).toBeTruthy();

        const before = Number(chance.getAttribute('data-chance'));
        expect(Number.isFinite(before)).toBe(true);
        expect(before).toBeGreaterThan(0);

        slider.value = String(Number(slider.max));
        slider.dispatchEvent(new Event('input', { bubbles: true }));

        const afterEl = document.getElementById('neg-chance');
        const after = Number(afterEl.getAttribute('data-chance'));
        expect(after).toBeLessThan(before);
        expect(afterEl.textContent).toContain(after + '%');
        expect(afterEl.classList.contains('neg-chance-red')).toBe(true);
    });

    it('показывает предупреждение при превышении бюджета клуба', () => {
        HL().openDialogueWithOffer(PLAYER, { ...OFFER, clubBudget: 1000, newSalary: 2000 });
        const slider = document.getElementById('neg-range-newSalary');
        slider.value = String(Math.max(Number(slider.min), 2000));
        slider.dispatchEvent(new Event('input', { bubbles: true }));

        const chance = document.getElementById('neg-chance');
        expect(chance.textContent).toContain('Превышен бюджет!');
        expect(Number(chance.getAttribute('data-chance'))).toBe(0);
    });
});

describe('v1.2.3: финансовая история', () => {
    it('logTransaction пополняет историю и держит только последние 100 записей', () => {
        HL().clearFinanceHistoryForTest();
        for (let i = 1; i <= 105; i++) HL().logTransaction('income', 100, 'T' + i);

        const history = HL().financeHistoryProbe();
        expect(history.length).toBe(100);
        expect(history[0].reason).toBe('T6');
        expect(history[99].reason).toBe('T105');
        expect(history[0]).toMatchObject({ type: 'income', amount: 100 });
        expect(typeof history[0].season).toBe('number');
        expect(typeof history[0].week).toBe('number');

        HL().logTransaction('expense', 250, 'Test expense');
        const after = HL().financeHistoryProbe();
        expect(after.length).toBe(100);
        expect(after[99]).toMatchObject({ type: 'expense', amount: 250 });
    });

    it('save/load сохраняет историю транзакций', async () => {
        HL().clearFinanceHistoryForTest();
        HL().logTransaction('income', 1234, 'Saved income');
        HL().logTransaction('expense', 567, 'Saved expense');

        await HL().saveGame();
        await new Promise(r => setTimeout(r, 100));

        HL().resetGame();
        expect(HL().financeHistoryProbe().length).toBe(0);

        const ok = await HL().loadGame();
        expect(ok).toBe(true);
        const history = HL().financeHistoryProbe();
        expect(history.length).toBe(2);
        expect(history[0]).toMatchObject({ type: 'income', amount: 1234, reason: 'Saved income' });
        expect(history[1]).toMatchObject({ type: 'expense', amount: 567, reason: 'Saved expense' });
    });

    it('вкладка «Финансы» есть в хабе и выводит операции в стиле NEON RINK', () => {
        expect(INDEX_HTML).toContain('data-atab="finance"');
        expect(STYLE_CSS).toContain('.finance-row');
        expect(STYLE_CSS).toContain('.neg-chance');

        const html = HL().financeTabHTMLForTest();
        expect(html).toContain('Saved income');
        expect(html).toContain('finance-row income');
        expect(html).toContain('finance-row expense');
        expect(html).toContain('finance-amount');
    });
});
