// v1.2 «Lean Agency»: экономика событий, старт с 2 клиентами,
// слоты через офис и групповая тренировка.
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION, getEventRewardCap, settleEventMoney } from '../src/features/economy/event-rewards.js';

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
    document.getElementById('ca-name').value = 'Lean Test';
    document.getElementById('ca-agency').value = 'Lean Agency';
    document.getElementById('ca-start').click();
});

const HL = () => window.__HL;

describe('v1.2: версия и старт', () => {
    it('версия v1.3 в коде и футере', () => {
        expect(VERSION).toBe('1.3.0');
        expect(INDEX_HTML).toContain('>v1.3<');
        expect(INDEX_HTML).not.toContain('>v1.0<');
        expect(HL().getState().version).toBe('1.3.0');
    });

    it('на старте 1 полевой и 1 вратарь, всего 2 слота', () => {
        const st = HL().getState();
        expect(st.roster.length).toBe(2);
        expect(st.slots).toBe(2);
        expect(st.rosterPositions.filter(p => p === 'G').length).toBe(1);
        expect(st.rosterPositions.filter(p => p !== 'G').length).toBe(1);
    });

    it('первый апгрейд офиса дешёвый и открывает 3-й слот', () => {
        const cost = HL().officeUpgradeCostForTest();
        expect(cost).toBeLessThanOrEqual(1500);
        const res = HL().upgradeOfficeNow();
        expect(res.ok).toBe(true);
        expect(res.slots).toBe(3);
    });
});

describe('v1.2: экономика событий', () => {
    it('на 1-м уровне событие не может выдать больше $500', () => {
        HL().setAgentLevel(1);
        HL().setMoneyForTest(1000000);
        HL().addClient('Кап Тест');
        const before = HL().getState().agentMoney;
        expect(HL().eventChoiceNow('sponsor_offer', 0)).toBe(true);
        const gained = HL().getState().agentMoney - before;
        expect(gained).toBeGreaterThanOrEqual(0);
        expect(gained).toBeLessThanOrEqual(500);
        expect(getEventRewardCap(1)).toBe(500);
    });

    it('вложенные деньги возвращаются, прибыль ограничена капом', () => {
        const invested = 5000;
        const delta = settleEventMoney(15000, 1, 'Взять долю', invested);
        expect(delta).toBeGreaterThanOrEqual(invested);
        expect(delta).toBeLessThanOrEqual(invested + 500);
        // Расходы списываются по номиналу, без «сгорания» и без масштабирования.
        expect(settleEventMoney(-20000, 1, 'Нанять юриста ($20K)')).toBe(-20000);
    });

    it('жирные события закрыты до высокого уровня', () => {
        HL().setAgentLevel(1);
        const probe = HL().eventPoolProbe('sponsor_offer');
        expect(probe.minLevel).toBe(4);
        expect(probe.availableAtLevel).toBe(false);
        expect(HL().eventRewardCapProbe(20)).toBeGreaterThanOrEqual(50000);
    });

    it('экран агентства показывает групповую тренировку и только офис', () => {
        const ui = HL().agencyScreenProbe();
        expect(ui.groupPanel).toBe(true);
        expect(ui.cards).toBe(1);
        expect(ui.moreButton).toBe(true);
    });
});

describe('v1.2: групповая тренировка', () => {
    it('включает один атрибут всем клиентам и отключается', () => {
        HL().setMoneyForTest(200000);
        expect(HL().setGroupTrainingNow('attack')).toBe('attack');
        const auto = HL().trainingAutoState();
        for (const name of HL().getState().roster) {
            expect(auto[name]).toBe('attack');
        }

        const before = HL().getState().agentMoney;
        HL().processTrainingsNow();
        HL().processTrainingsNow();
        expect(HL().getState().agentMoney).toBeLessThan(before);
        expect(HL().getState().agentMoney).toBeGreaterThanOrEqual(0);

        expect(HL().setGroupTrainingNow(null)).toBeNull();
        expect(HL().trainingAutoState()).toEqual({});
    });
});
