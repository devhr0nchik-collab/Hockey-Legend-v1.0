// ============================================================
// Переговоры 2.0: интерактивный диалог агент ↔ клуб.
// Универсальное ядро оценки (agent/club), шкалы Interest/Patience,
// контр-оффер, «Надавить» с выходом клуба при терпении < 20%,
// split-screen конструктор и персистентность сессии.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const STYLE_CSS = readFileSync(join(process.cwd(), 'style.css'), 'utf8');

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
    document.getElementById('ca-name').value = 'Диалог Тест';
    document.getElementById('ca-agency').value = 'Dialogue Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Диалог Клиент');
});

// Пакет условий для отправки клубу.
const pkg = (overrides = {}) => ({
    newSalary: 2000, years: 3, agentCommissionRate: 0.10, signingBonus: 0,
    goalBonus: 0, assistBonus: 0, guaranteedYears: 0,
    ...overrides
});

// Детерминированный клуб для диалоговых тестов: NHL, большой бюджет, престиж 85.
const CLUB_OFFER = {
    club: 'Dialogue Test Club', league: 'NHL', prestige: 85,
    newSalary: 2500, years: 3, signingBonus: 0, agentCommissionRate: 0.10,
    goalBonus: 500, assistBonus: 300, cleanSheetBonus: 0, savesBonus: 0, gamesPlayedBonus: 0,
    guaranteedYears: 1, clubBudget: 100000000, trueInterest: 4, interest: 6, acceptChance: 80
};
const openDialogue = () => window.__HL.openDialogueWithOffer('Диалог Клиент', { ...CLUB_OFFER });

describe('переговоры 2.0: универсальное ядро оценки', () => {
    it('оценка возвращает score, verdict, reasons и контр-оффер', () => {
        const ev = window.__HL.evaluateContractPackage('Диалог Клиент', pkg({ newSalary: 5000, league: 'NHL', club: 'Test Club', prestige: 85, clubBudget: 100000000 }), 'club');
        expect(ev).toBeTruthy();
        expect(ev.perspective).toBe('club');
        expect(ev.score).toBeGreaterThanOrEqual(0);
        expect(ev.score).toBeLessThanOrEqual(100);
        expect(['accept', 'counter', 'reject']).toContain(ev.verdict);
        expect(Array.isArray(ev.reasons)).toBe(true);
        expect(ev.counter).toBeTruthy();
        expect(ev.limits.salaryMax).toBeGreaterThan(0);
    });

    it('перспективы agent и club зеркальны: завышенная ЗП плоха клубу, но не агенту', () => {
        const offer = pkg({ newSalary: 8000, agentCommissionRate: 0.18, league: 'NHL', club: 'Test Club', prestige: 85, clubBudget: 100000000 });
        const club = window.__HL.evaluateContractPackage('Диалог Клиент', offer, 'club');
        const agent = window.__HL.evaluateContractPackage('Диалог Клиент', offer, 'agent');
        expect(club.reasons.some(r => r.reason === 'salary')).toBe(true);
        expect(club.reasons.some(r => r.reason === 'commission')).toBe(true);
        expect(agent.reasons.some(r => r.reason === 'salary')).toBe(false);
        expect(agent.score).toBeGreaterThan(club.score);
        // Контр-оффер клуба снижает условия, агента — повышает.
        expect(club.counter.newSalary).toBeLessThan(offer.newSalary);
        expect(agent.counter.newSalary).toBeGreaterThanOrEqual(offer.newSalary);
        expect(club.counter.agentCommissionRate).toBeLessThanOrEqual(offer.agentCommissionRate);
        expect(agent.counter.agentCommissionRate).toBeGreaterThanOrEqual(offer.agentCommissionRate);
    });

    it('оценка детерминирована и не двигает sim-RNG', () => {
        const offer = pkg({ newSalary: 3000 });
        window.__HL.setSeed(4242);
        const drawsBefore = window.__HL.mvDraws();
        const first = window.__HL.evaluateContractPackage('Диалог Клиент', offer, 'club');
        const drawsAfter = window.__HL.mvDraws();
        const second = window.__HL.evaluateContractPackage('Диалог Клиент', offer, 'club');
        expect(second).toEqual(first);
        expect(drawsAfter).toBe(drawsBefore); // ядро чистое, без RNG
    });

    it('контр-оффер клуба не опускается ниже исходного оффера (anchor)', () => {
        const anchor = pkg({ newSalary: 1500, years: 3, agentCommissionRate: 0.10 });
        const ev = window.__HL.evaluateContractPackage('Диалог Клиент', pkg({ newSalary: 6000, years: 6 }), 'club', anchor);
        expect(ev.counter.newSalary).toBeGreaterThanOrEqual(anchor.newSalary);
        expect(ev.counter.years).toBeGreaterThanOrEqual(anchor.years);
    });

    it('нереальный пакет даёт hard-reject с причиной', () => {
        const ev = window.__HL.evaluateContractPackage('Диалог Клиент', pkg({ newSalary: 90000, league: 'NHL', club: 'Test Club', prestige: 85, clubBudget: 100000000 }), 'club');
        expect(ev.hardReject).toBe(true);
        expect(['budget', 'cap']).toContain(ev.hardReason);
        expect(ev.verdict).toBe('reject');
    });
});

describe('переговоры 2.0: шкалы NEON RINK', () => {
    it('getGaugeTone: >=60 зелёный, 30–59 янтарь, <30 красный', () => {
        expect(window.__HL.gaugeTone(100)).toBe('green');
        expect(window.__HL.gaugeTone(60)).toBe('green');
        expect(window.__HL.gaugeTone(59)).toBe('amber');
        expect(window.__HL.gaugeTone(30)).toBe('amber');
        expect(window.__HL.gaugeTone(29)).toBe('red');
        expect(window.__HL.gaugeTone(0)).toBe('red');
    });

    it('шкалы рендерятся с цветом и шириной заполнения', () => {
        const html = window.__HL.buildGaugesHTML('Диалог Клиент', { patience: 80, interest: 45, offer: pkg() });
        expect(html).toContain('neg-gauge-green');   // patience 80
        expect(html).toContain('neg-gauge-amber');   // interest 45
        expect(html).toContain('width:80%');
        expect(html).toContain('width:45%');
        expect(html).toMatch(/Интерес к игроку|Interest in player/);
        expect(html).toMatch(/Терпение|Patience/);
    });

    it('CSS содержит неоновые классы шкал и ползунков', () => {
        expect(STYLE_CSS).toContain('.neg-gauge-green');
        expect(STYLE_CSS).toContain('.neg-gauge-amber');
        expect(STYLE_CSS).toContain('.neg-gauge-red');
        expect(STYLE_CSS).toContain('.neg-range');
        expect(STYLE_CSS).toContain('.negotiation-console');
        expect(STYLE_CSS).toContain('.neg-submit-btn');
        expect(STYLE_CSS).toContain('#c6ff00'); // лайм NEON RINK
        expect(STYLE_CSS).toContain('#ffb300'); // янтарь
        expect(STYLE_CSS).toContain('#ff2e55'); // красный
    });
});

describe('переговоры 2.0: диалоговые раунды', () => {
    it('открытие диалога создаёт шкалы и конструктор в DOM', () => {
        const state = openDialogue();
        expect(state).toBeTruthy();
        expect(state.patience).toBe(100);
        expect(state.interest).toBe(70); // 50 + trueInterest(4) * 5
        expect(state.phase).toBe('builder');
        expect(document.getElementById('negotiation-modal').style.display).toBe('flex');
        expect(document.querySelector('.negotiation-console.mode-dialogue')).toBeTruthy();
        expect(document.getElementById('neg-builder-panel')).toBeTruthy();
        expect(document.querySelectorAll('#neg-builder-body .neg-range').length).toBeGreaterThanOrEqual(5);
        expect(document.getElementById('neg-range-newSalary')).toBeTruthy();
        expect(document.getElementById('neg-range-agentCommissionRate')).toBeTruthy();
        expect(document.querySelector('.neg-submit-btn')).toBeTruthy();
        expect(document.querySelectorAll('#neg-gauges .neg-gauge').length).toBe(2);
    });

    it('раунд детерминирован: один seed-контекст → одинаковый ответ клуба', () => {
        const run = () => {
            window.__HL.closeDialogue();
            openDialogue();
            return window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 4000 }), 'offer');
        };
        const first = run();
        const second = run();
        expect(first).toBeTruthy();
        expect(second.state.counterOffer).toEqual(first.state.counterOffer);
        expect(second.state.patience).toBe(first.state.patience);
        expect(second.state.interest).toBe(first.state.interest);
        expect(second.state.messages).toEqual(first.state.messages);
    });

    it('клуб отвечает текстом и контр-оффером на завышенный пакет', () => {
        window.__HL.closeDialogue();
        openDialogue();
        const res = window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 8000, agentCommissionRate: 0.20 }), 'offer');
        expect(res.walked).toBe(false);
        expect(res.state.phase).toBe('response');
        expect(res.state.counterOffer).toBeTruthy();
        expect(res.state.counterOffer.newSalary).toBeLessThan(8000);
        expect(res.state.counterOffer.agentCommissionRate).toBeLessThan(0.20);
        const clubMsg = res.state.messages.filter(m => m.from === 'club').pop();
        expect(clubMsg.text.length).toBeGreaterThan(10);
        expect(clubMsg.hasOffer).toBe(true);
        // Терпение потрачено, interest обновлён.
        expect(res.state.patience).toBeLessThan(100);
    });

    it('контр-оффер автоматически подставляется в ползунки', () => {
        window.__HL.closeDialogue();
        openDialogue();
        const res = window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 8000 }), 'offer');
        const salaryInput = document.getElementById('neg-range-newSalary');
        expect(res.state.draft.newSalary).toBe(res.state.counterOffer.newSalary);
        expect(salaryInput).toBeTruthy();
        // UI-обновление (как после клика «Сделать предложение»): ползунок = контр-оффер.
        window.__HL.refreshDialogueUI();
        expect(Number(document.getElementById('neg-range-newSalary').value)).toBe(res.state.counterOffer.newSalary);
        expect(document.querySelector('.neg-slider.counter-changed')).toBeTruthy();
    });

    it('«Надавить» при терпении < 20% — клуб выходит из сделки', () => {
        window.__HL.closeDialogue();
        openDialogue();
        // Доводим терпение до красной зоны повторными завышенными офферами.
        let guard = 0;
        let state = window.__HL.negotiationState();
        while (state.patience >= 20 && !state.finished && guard < 12) {
            window.__HL.dialogueRound('Диалог Клиент', null, 'adjust');
            const res = window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 8000, years: 6, agentCommissionRate: 0.20, signingBonus: 900000 }), 'offer');
            state = res.state;
            guard++;
            if (res.walked) break;
        }
        expect(state.finished || state.walkedAway).toBe(false); // клуб ещё в сделке, но терпение на исходе
        expect(state.patience).toBeLessThan(20);
        const press = window.__HL.dialogueRound('Диалог Клиент', null, 'press');
        expect(press.walked).toBe(true);
        expect(press.state.finished).toBe(true);
        expect(press.state.walkedAway).toBe(true);
    });

    it('«Надавить» при терпении >= 20% тратит терпение и может улучшить оффер', () => {
        window.__HL.closeDialogue();
        openDialogue();
        window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 4000 }), 'offer');
        const before = window.__HL.negotiationState();
        const res = window.__HL.dialogueRound('Диалог Клиент', null, 'press');
        expect(res.walked).toBe(false);
        expect(res.state.patience).toBeLessThan(before.patience);
        expect(res.state.phase).toBe('response');
        // Контр-оффер не ухудшается: зарплата >= предыдущей.
        expect(res.state.counterOffer.newSalary).toBeGreaterThanOrEqual(before.counterOffer.newSalary);
    });

    it('«Скорректировать» возвращает в конструктор и тратит немного терпения', () => {
        window.__HL.closeDialogue();
        openDialogue();
        window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 4000 }), 'offer');
        const before = window.__HL.negotiationState();
        const res = window.__HL.dialogueRound('Диалог Клиент', null, 'adjust');
        expect(res.state.phase).toBe('builder');
        expect(res.state.patience).toBe(before.patience - 5);
        expect(res.finished).toBe(false);
    });

    it('«Принять контр-оффер» подписывает контракт на условиях клуба', () => {
        window.__HL.closeDialogue();
        openDialogue();
        const res = window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 4000 }), 'offer');
        const counter = res.state.counterOffer;
        const signed = window.__HL.acceptDialogue('Диалог Клиент');
        expect(signed).toBeTruthy();
        expect(signed.club).toBe(res.state.club);
        expect(signed.salary).toBe(counter.newSalary);
        expect(signed.years).toBe(counter.years);
        // После подписания negotiations очищены.
        expect(Object.keys(window.__HL.negotiationSessions('Диалог Клиент'))).toHaveLength(0);
    });

    it('ползунок меняет черновик пакета и итоговую комиссию', () => {
        window.__HL.closeDialogue();
        openDialogue();
        const salary = document.getElementById('neg-range-newSalary');
        salary.value = String(Number(salary.max));
        salary.dispatchEvent(new Event('input', { bubbles: true }));
        const state = window.__HL.negotiationState();
        expect(state.draft.newSalary).toBe(Number(salary.max));
        const rate = document.getElementById('neg-range-agentCommissionRate');
        rate.value = '15';
        rate.dispatchEvent(new Event('input', { bubbles: true }));
        const total = document.getElementById('neg-builder-total');
        expect(total.textContent).toContain('15%');
        expect(window.__HL.negotiationState().draft.agentCommissionRate).toBe(0.15);
    });

    it('повторное открытие продолжает сохранённый диалог, а не начинает заново', () => {
        window.__HL.closeDialogue();
        openDialogue();
        window.__HL.dialogueRound('Диалог Клиент', pkg({ newSalary: 8000 }), 'offer');
        const before = window.__HL.negotiationState();
        window.__HL.closeDialogue();
        // reopenNegotiation открывает тот же сохранённый оффер, не сбрасывая сессию.
        const resumed = window.__HL.reopenNegotiation('Диалог Клиент');
        expect(resumed.patience).toBe(before.patience);
        expect(resumed.interest).toBe(before.interest);
        expect(resumed.round).toBe(before.round);
        expect(resumed.phase).toBe(before.phase);
        expect(resumed.counterOffer.newSalary).toBe(before.counterOffer.newSalary);
        expect(resumed.messages.length).toBe(before.messages.length);
    });

    it('сессия диалога переживает закрытие и сейв', async () => {
        window.__HL.addClient('Сессия Клиент');
        window.__HL.openDialogueWithOffer('Сессия Клиент', { ...CLUB_OFFER });
        window.__HL.dialogueRound('Сессия Клиент', pkg({ newSalary: 4000 }), 'offer');
        const before = window.__HL.negotiationState();
        window.__HL.closeDialogue();
        const sessions = window.__HL.negotiationSessions('Сессия Клиент');
        expect(Object.keys(sessions).length).toBe(1);
        const saved = Object.values(sessions)[0];
        expect(saved.patience).toBe(before.patience);
        expect(saved.counterOffer.newSalary).toBe(before.counterOffer.newSalary);

        await window.__HL.saveGame();
        const data = window._lastSaveData;
        const entry = data.playerNegotiations['Сессия Клиент'];
        expect(entry.sessions).toBeTruthy();
        expect(Object.values(entry.sessions)[0].counterOffer).toBeTruthy();
    });
});
