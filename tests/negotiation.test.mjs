// ============================================================
// Переговоры: мотивация, новые пункты контракта, hard-reject
// и скрытые лимиты клуба на низком уровне агента.
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
    document.getElementById('ca-name').value = 'Переговоры Тест';
    document.getElementById('ca-agency').value = 'Negotiation Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Переговоры Клиент');
});

const baseOffer = (overrides = {}) => ({
    club: 'Test Club', league: 'MHL', prestige: 55,
    newSalary: 100, years: 3, signingBonus: 0,
    goalBonus: 1000, gamesPlayedBonus: 200,
    guaranteedYears: 1, clubBudget: 10000000,
    ...overrides
});

describe('переговоры: контракт и мотивация', () => {
    it('характер детерминированно превращается в скрытую мотивацию', () => {
        expect(window.__HL.motivationForCharacter('pragmatic')).toBe('greed');
        expect(window.__HL.motivationForCharacter('ambitious')).toBe('ambition');
        expect(window.__HL.motivationForCharacter('loyal')).toBe('loyalty');
        expect(window.__HL.motivationForCharacter('calm')).toBe('loyalty');
        expect(window.__HL.motivationForCharacter('capricious')).toBe('playtime');
    });

    it('старые контракты получают безопасные дефолты', () => {
        const p = window.__HL.normalizeContractData({ character: 'loyal', contractYears: 4, guaranteedYears: 99 });
        expect(p.motivation).toBe('loyalty');
        expect(p.goalBonus).toBe(0);
        expect(p.assistBonus).toBe(0);
        expect(p.cleanSheetBonus).toBe(0);
        expect(p.savesBonus).toBe(0);
        expect(p.gamesPlayedBonus).toBe(0);
        expect(p.guaranteedYears).toBe(4);
    });

    it('нереальная зарплата приводит к hard-reject', () => {
        const demand = window.__HL.evaluateNegotiationDemand('Переговоры Клиент', baseOffer({ newSalary: 5000, clubBudget: 1000 }), 'money');
        expect(demand.hardReject).toBe(true);
        expect(demand.reason).toBe('budget');
    });

    it('гарантия больше срока контракта приводит к hard-reject', () => {
        const demand = window.__HL.evaluateNegotiationDemand('Переговоры Клиент', baseOffer({ years: 1, guaranteedYears: 1 }), 'guarantee');
        expect(demand.hardReject).toBe(true);
        expect(demand.reason).toBe('guaranteedYears');
    });

    it('реалистичная гарантия не обрывает переговоры', () => {
        const demand = window.__HL.evaluateNegotiationDemand('Переговоры Клиент', baseOffer({ years: 4, guaranteedYears: 1 }), 'guarantee');
        expect(demand.hardReject).toBe(false);
        expect(demand.proposedGuaranteedYears).toBe(2);
    });

    it('уровень 1 скрывает бюджет, уровень 10 раскрывает', () => {
        const offer = baseOffer({ clubBudget: 5000000 });
        window.__HL.setAgentLevel(1);
        const hidden = window.__HL.getNegotiationInsight('Переговоры Клиент', offer);
        expect(hidden.budgetKnown).toBe(false);
        expect(hidden.budgetText).toBe('???');

        window.__HL.setAgentLevel(10);
        const open = window.__HL.getNegotiationInsight('Переговоры Клиент', offer);
        expect(open.budgetKnown).toBe(true);
        expect(open.budgetText).toContain('$');
        expect(open.interestKnown).toBe(true);
        window.__HL.setAgentLevel(1);
    });

    it('UI-панель переговоров показывает новые поля и скрытые лимиты', () => {
        const offer = baseOffer({ clubBudget: 5000000 });
        window.__HL.setAgentLevel(1);
        const hidden = window.__HL.buildNegotiationInsightHTML('Переговоры Клиент', offer);
        expect(hidden).toMatch(/Бюджет клуба|Club budget/);
        expect(hidden).toMatch(/Мотивация|Motivation/);
        expect(hidden).toContain('???');

        window.__HL.setAgentLevel(10);
        const open = window.__HL.buildNegotiationInsightHTML('Переговоры Клиент', offer);
        expect(open).toContain('$');
        expect(open).not.toContain('???');
        window.__HL.setAgentLevel(1);
    });

    it('сейв хранит новые поля контракта без изменения формата игрока', async () => {
        await window.__HL.saveGame();
        const data = window._lastSaveData;
        expect(data.players[0].length).toBe(33);
        expect(Array.isArray(data.contractExtras['Переговоры Клиент'])).toBe(true);
        expect(data.contractExtras['Переговоры Клиент']).toHaveLength(7);
    });

    it('вратарь не требует и не получает бонус за голы', () => {
        const goalieName = window.__HL.addClient('Вратарь Тест', 'G');
        const offer = window.__HL.transferOfferProbe(goalieName);
        expect(offer).toBeTruthy();
        expect(offer.goalBonus).toBe(0);
        expect((offer.cleanSheetBonus || 0) + (offer.savesBonus || 0)).toBeGreaterThan(0);
        expect(window.__HL.contractBonusKinds(goalieName)).not.toContain('goalBonus');

        const demand = window.__HL.evaluateNegotiationDemand(goalieName, { ...baseOffer(), ...offer }, 'goalBonus');
        expect(demand.proposedGoalBonus).toBe(0);
        expect(demand.hardReject).toBe(true);
        expect(demand.reason).toBe('positionBonus');

        const shutoutDemand = window.__HL.evaluateNegotiationDemand(goalieName, { ...baseOffer(), ...offer }, 'cleanSheetBonus');
        expect(shutoutDemand.hardReject).toBe(false);
        expect(shutoutDemand.proposedCleanSheetBonus).toBeGreaterThan(0);
    });

    it('оценка требования детерминирована при одном seed', () => {
        const offer = baseOffer({ newSalary: 100, years: 4, guaranteedYears: 0 });
        window.__HL.setSeed(777);
        const first = window.__HL.evaluateNegotiationDemand('Переговоры Клиент', offer, 'goalBonus');
        window.__HL.setSeed(777);
        const second = window.__HL.evaluateNegotiationDemand('Переговоры Клиент', offer, 'goalBonus');
        expect(second).toEqual(first);
    });
});