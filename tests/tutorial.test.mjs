// ============================================================
// Туториалы: агент и президент запускаются по одному разу,
// «Пропустить» ставит нужный флаг в gameSettings.
// ============================================================
import { beforeEach, describe, expect, it } from 'vitest';
import {
    TutorialManager,
    TUTORIAL_FLAGS,
    TUTORIAL_SCENARIOS
} from '../src/features/tutorial/TutorialManager.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function makeDom() {
    document.body.innerHTML = `
        <div id="office-screen" class="mobile-screen"></div>
        <div data-nav="clients"><span id="talent-target"></span></div>
        <div class="talent-card-wrap"></div>
        <button id="player-dialogue-offer-btn">Предложить контракт</button>
        <button id="btn-play-week">Играть неделю</button>
        <div data-nav="agency"></div>
        <div id="club-hub-screen"><div class="mobile-header">Клуб</div></div>
        <div data-club-tab data-chub="decisions"></div>
        <div data-club-tab data-chub="upgrade"></div>
        <input id="setting-match-view-full" type="radio">
        <div id="neg-builder-body"><input class="neg-range" type="range"></div>
    `;
}

function makeManager(overrides = {}) {
    const settings = overrides.settings || {
        tutorialAgentDone: false,
        tutorialPresidentDone: false
    };
    const state = { saves: 0, finishes: [] };
    const manager = new TutorialManager({
        getSettings: () => settings,
        saveSettings: () => { state.saves++; },
        t: (key) => key,
        onFinish: (info) => state.finishes.push(info),
        ...overrides
    });
    return { manager, settings, state };
}

beforeEach(() => {
    makeDom();
});

describe('TutorialManager: сценарий агента', () => {
    it('запускается один раз и не стартует после флага', () => {
        const { manager, settings } = makeManager();

        expect(manager.start('agent')).toBe(true);
        expect(manager.getState()).toMatchObject({
            scenario: 'agent',
            stepId: 'talent-base',
            waiting: false,
            visible: true
        });
        expect(manager.start('agent')).toBe(false);

        manager.skip();
        expect(settings.tutorialAgentDone).toBe(true);
        expect(settings.tutorialPresidentDone).toBe(false);
        expect(manager.start('agent')).toBe(false);
    });

    it('ведёт за руку: таланты → игрок → контракт → неделя', async () => {
        const { manager, settings } = makeManager();
        manager.start('agent');
        expect(manager.getState().stepId).toBe('talent-base');

        document.querySelector('[data-nav="clients"]').click();
        await sleep(20);
        expect(manager.getState().stepId).toBe('pick-player');

        document.querySelector('.talent-card-wrap').click();
        await sleep(20);
        expect(manager.getState().stepId).toBe('contract');

        // Клик по «Предложить контракт» скрывает туториал и ждёт подписания.
        document.getElementById('player-dialogue-offer-btn').click();
        await sleep(20);
        expect(manager.getState()).toMatchObject({ stepId: 'contract', visible: false });

        expect(manager.notify('client-signed')).toBe(true);
        expect(manager.getState()).toMatchObject({ stepId: 'play-week', visible: true });

        document.getElementById('btn-play-week').click();
        await sleep(20);
        expect(manager.getState().scenario).toBeNull();
        expect(settings.tutorialAgentDone).toBe(true);
    });

    it('содержит 4 шага и подсвечивает базу, игрока, контракт и неделю', () => {
        const { manager } = makeManager();
        manager.start('agent');
        const ids = [];
        const targets = [];
        for (let i = 0; i < TUTORIAL_SCENARIOS.agent.steps.length; i++) {
            const st = manager.getState();
            ids.push(st.stepId);
            const step = TUTORIAL_SCENARIOS.agent.steps[i];
            if (step.target) {
                expect(document.querySelector(step.target)).not.toBeNull();
                targets.push(step.target);
            }
            manager.next();
        }
        expect(ids).toEqual(['talent-base', 'pick-player', 'contract', 'play-week']);
        expect(targets).toEqual([
            '[data-nav="clients"]',
            '.talent-card-wrap',
            '#player-dialogue-offer-btn',
            '#btn-play-week'
        ]);
    });

    it('завершение всех шагов ставит флаг и закрывает оверлей', () => {
        const { manager, settings, state } = makeManager();
        manager.start('agent');
        const total = TUTORIAL_SCENARIOS.agent.steps.length;
        for (let i = 0; i < total; i++) manager.next();
        expect(settings.tutorialAgentDone).toBe(true);
        expect(manager.getState().scenario).toBeNull();
        expect(state.finishes).toEqual([{ scenario: 'agent', reason: 'complete' }]);
        expect(document.getElementById('tutorial-overlay').style.display).toBe('none');
    });
});

describe('TutorialManager: сценарий президента', () => {
    it('запускается один раз и «Пропустить» ставит только президентский флаг', () => {
        const { manager, settings, state } = makeManager();
        expect(manager.start('president')).toBe(true);
        expect(manager.getState().stepId).toBe('welcome');
        expect(manager.start('president')).toBe(false);

        manager.skip();
        expect(settings.tutorialPresidentDone).toBe(true);
        expect(settings.tutorialAgentDone).toBe(false);
        expect(settings[TUTORIAL_FLAGS.president]).toBe(true);
        expect(state.saves).toBe(1);
        expect(state.finishes[0].reason).toBe('skip');
        expect(manager.start('president')).toBe(false);
    });

    it('содержит 5 шагов и подсвечивает клуб, инфраструктуру, матчи и совет', () => {
        const { manager } = makeManager();
        manager.start('president');
        const ids = [];
        const targets = [];
        for (let i = 0; i < TUTORIAL_SCENARIOS.president.steps.length; i++) {
            const st = manager.getState();
            ids.push(st.stepId);
            const step = TUTORIAL_SCENARIOS.president.steps[i];
            if (step.target) {
                expect(document.querySelector(step.target)).not.toBeNull();
                targets.push(step.target);
            }
            manager.next();
        }
        expect(ids).toEqual(['welcome', 'club-screen', 'infrastructure', 'match-sim', 'board']);
        expect(targets).toEqual([
            '#club-hub-screen .mobile-header',
            '[data-chub="upgrade"]',
            '#setting-match-view-full',
            '[data-chub="decisions"]'
        ]);
    });
});
