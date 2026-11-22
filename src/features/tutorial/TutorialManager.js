// ============================================================
// TutorialManager — пошаговое обучение агента и президента.
// Логика не знает про script.js: сценарии, флаги и DOM передаются снаружи.
// ============================================================

export const TUTORIAL_FLAGS = {
    agent: 'tutorialAgentDone',
    president: 'tutorialPresidentDone'
};

// Тексты намеренно хранятся ключами i18n.js.
export const TUTORIAL_SCENARIOS = {
    agent: {
        id: 'agent',
        titleKey: 'Обучение агента',
        steps: [
            {
                id: 'talent-base',
                titleKey: 'База талантов',
                textKey: 'Нажми «Клиенты» в нижнем меню — откроется база свободных агентов.',
                target: '[data-nav="clients"]'
            },
            {
                id: 'pick-player',
                titleKey: 'Игрок без клуба',
                textKey: 'Выбери карточку с меткой FA — откроется профиль игрока.',
                target: '.talent-card-wrap'
            },
            {
                id: 'contract',
                titleKey: 'Первый контракт',
                textKey: 'Вкладка «Диалог»: нажми «Предложить контракт» и подтверди сделку.',
                target: '#player-dialogue-offer-btn',
                advanceOn: 'client-signed'
            },
            {
                id: 'play-week',
                titleKey: 'Играть неделю',
                textKey: 'Нажми «Играть неделю» — начнётся поиск клуба для твоего клиента.',
                target: '#btn-play-week'
            }
        ]
    },
    president: {
        id: 'president',
        titleKey: 'Обучение президента',
        steps: [
            {
                id: 'welcome',
                titleKey: 'Добро пожаловать, президент',
                textKey: 'Ты купил клуб. Теперь ты управляешь бюджетом и инфраструктурой.',
                target: null
            },
            {
                id: 'club-screen',
                titleKey: 'Экран клуба',
                textKey: 'Здесь бюджет и зарплатная ведомость. Следи за нагрузкой, чтобы совет не потерял доверие.',
                target: '#club-hub-screen .mobile-header'
            },
            {
                id: 'infrastructure',
                titleKey: 'Инфраструктура',
                textKey: 'Строй стадион и базу, чтобы усилить команду и доходы.',
                target: '[data-chub="upgrade"]'
            },
            {
                id: 'match-sim',
                titleKey: 'Симуляция матчей',
                textKey: 'Настрой, как показывать матчи: полностью, только счёт или без просмотра.',
                target: '#setting-match-view-full'
            },
            {
                id: 'board',
                titleKey: 'Совет директоров',
                textKey: 'За провалы и долги совет может уволить. Держи цели сезона под контролем.',
                target: '[data-chub="decisions"]'
            }
        ]
    }
};

export class TutorialManager {
    constructor(options = {}) {
        this.doc = options.document || document;
        this.win = this.doc.defaultView || (typeof window !== 'undefined' ? window : globalThis);
        this.getSettings = options.getSettings || (() => ({}));
        this.saveSettings = options.saveSettings || (() => {});
        this.t = options.t || ((key) => key);
        this.scenarios = options.scenarios || TUTORIAL_SCENARIOS;
        this.onStepEnter = options.onStepEnter || null;
        this.onStepExit = options.onStepExit || null;
        this.onFinish = options.onFinish || null;

        this.scenario = null;
        this.index = 0;
        this.waiting = false;
        this._seen = new Set();
        this._targetLocked = false;
        this._root = null;
        this._resizeHandler = () => this._position();
    }

    isDone(scenario) {
        const flag = TUTORIAL_FLAGS[scenario];
        return !!(flag && this.getSettings()[flag]);
    }

    start(scenario, options = {}) {
        if (!this.scenarios[scenario]) return false;
        if (this.scenario) return false;
        if (!options.force && this.isDone(scenario)) return false;

        this.scenario = scenario;
        this.index = 0;
        this.waiting = false;
        this._seen = new Set();
        this._ensureDom();
        this.doc.addEventListener('click', this._onDocumentClick, true);
        if (this.win && this.win.addEventListener) this.win.addEventListener('resize', this._resizeHandler);
        this._render();
        return true;
    }

    next() {
        if (!this.scenario || this.waiting) return false;
        const scenario = this.scenarios[this.scenario];
        const step = scenario.steps[this.index];
        if (!step) return false;
        if (this.onStepExit) this.onStepExit({ scenario: this.scenario, step, index: this.index });

        this.index++;
        if (this.index >= scenario.steps.length) {
            this._markDone(this.scenario);
            this._finish('complete');
            return true;
        }
        this._render();
        return true;
    }

    skip() {
        if (!this.scenario) return false;
        this._markDone(this.scenario);
        this._finish('skip');
        return true;
    }

    notify(eventName) {
        if (!eventName) return false;
        this._seen.add(eventName);
        if (!this.scenario) return false;
        const scenario = this.scenarios[this.scenario];
        const step = scenario.steps[this.index];
        if (step && step.advanceOn === eventName) {
            this.next();
            return true;
        }
        if (step && step.waitFor === eventName) {
            this._render();
            return true;
        }
        return false;
    }

    refresh() {
        if (!this.scenario) return false;
        this._render();
        return true;
    }

    getState() {
        const scenario = this.scenario ? this.scenarios[this.scenario] : null;
        const step = scenario ? scenario.steps[this.index] : null;
        const settings = this.getSettings() || {};
        return {
            scenario: this.scenario,
            index: this.index,
            stepId: step ? step.id : null,
            stepsTotal: scenario ? scenario.steps.length : 0,
            waiting: this.waiting,
            visible: !!(this._root && this._root.style.display !== 'none'),
            flags: {
                agent: !!settings[TUTORIAL_FLAGS.agent],
                president: !!settings[TUTORIAL_FLAGS.president]
            }
        };
    }

    destroy() {
        this._hideUi();
        this._removeListeners();
        this.scenario = null;
        this.index = 0;
        this.waiting = false;
    }

    // ============ DOM ============
    _ensureDom() {
        if (this._root && this.doc.body.contains(this._root)) return;
        const root = this.doc.createElement('div');
        root.id = 'tutorial-overlay';
        root.className = 'tutorial-overlay';
        root.style.display = 'none';
        root.setAttribute('data-tutorial-overlay', '');
        this.doc.body.appendChild(root);
        this._root = root;
    }

    _hideUi() {
        if (this._root) {
            this._root.style.display = 'none';
            this._root.innerHTML = '';
        }
    }

    _render() {
        const scenario = this.scenarios[this.scenario];
        if (!scenario) return;
        const step = scenario.steps[this.index];
        if (!step) return;

        if (step.waitFor && !this._seen.has(step.waitFor)) {
            this.waiting = true;
            this._hideUi();
            return;
        }
        this.waiting = false;
        if (this.onStepEnter) this.onStepEnter({ scenario: this.scenario, step, index: this.index });

        this._ensureDom();
        const root = this._root;
        root.style.display = 'block';
        root.innerHTML = '';

        const shade = this.doc.createElement('div');
        shade.className = 'tutorial-shade';
        shade.setAttribute('data-tutorial-shade', '');
        root.appendChild(shade);

        const ring = this.doc.createElement('div');
        ring.className = 'tutorial-spotlight';
        ring.setAttribute('data-tutorial-spotlight', '');
        root.appendChild(ring);

        const card = this.doc.createElement('div');
        card.className = 'tutorial-card';
        card.setAttribute('data-tutorial-card', '');
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-live', 'polite');

        const stepLabel = this.doc.createElement('div');
        stepLabel.className = 'tutorial-step';
        stepLabel.textContent = `${this.t('Шаг')} ${this.index + 1} / ${scenario.steps.length}`;

        const title = this.doc.createElement('div');
        title.className = 'tutorial-title';
        title.textContent = this.t(step.titleKey);

        const text = this.doc.createElement('div');
        text.className = 'tutorial-text';
        text.textContent = this.t(step.textKey);

        const actions = this.doc.createElement('div');
        actions.className = 'tutorial-actions';

        const skip = this.doc.createElement('button');
        skip.type = 'button';
        skip.className = 'tutorial-btn tutorial-btn-skip';
        skip.setAttribute('data-tutorial-skip', '');
        skip.textContent = this.t('Пропустить');
        skip.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.skip();
        });

        const next = this.doc.createElement('button');
        next.type = 'button';
        next.className = 'tutorial-btn tutorial-btn-next';
        next.setAttribute('data-tutorial-next', '');
        next.textContent = this.t('Далее');
        next.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.next();
        });

        actions.appendChild(skip);
        actions.appendChild(next);
        card.appendChild(stepLabel);
        card.appendChild(title);
        card.appendChild(text);
        card.appendChild(actions);
        root.appendChild(card);

        this._position();
    }

    _position() {
        if (!this._root || this._root.style.display === 'none') return;
        const scenario = this.scenarios[this.scenario];
        const step = scenario ? scenario.steps[this.index] : null;
        const target = step && step.target ? this.doc.querySelector(step.target) : null;
        const ring = this._root.querySelector('[data-tutorial-spotlight]');
        const card = this._root.querySelector('[data-tutorial-card]');
        const shade = this._root.querySelector('[data-tutorial-shade]');
        if (!ring || !card || !shade) return;

        if (!target) {
            ring.style.display = 'none';
            shade.style.display = 'block';
            shade.style.left = '0';
            shade.style.top = '0';
            shade.style.width = '100%';
            shade.style.height = '100%';
            card.style.left = '50%';
            card.style.bottom = '24px';
            card.style.top = 'auto';
            card.style.transform = 'translateX(-50%)';
            return;
        }

        const rect = target.getBoundingClientRect();
        const pad = 6;
        const left = Math.max(0, rect.left - pad);
        const top = Math.max(0, rect.top - pad);
        const width = Math.max(0, rect.width + pad * 2);
        const height = Math.max(0, rect.height + pad * 2);
        const vw = this.win.innerWidth || 1024;
        const vh = this.win.innerHeight || 768;

        ring.style.display = 'block';
        ring.style.left = left + 'px';
        ring.style.top = top + 'px';
        ring.style.width = width + 'px';
        ring.style.height = height + 'px';

        // Затемнение рисуем четырьмя панелями: центральная область остаётся кликабельной.
        shade.style.display = 'none';
        let panels = this._root.querySelectorAll('[data-tutorial-shade-part]');
        if (panels.length !== 4) {
            this._root.querySelectorAll('[data-tutorial-shade-part]').forEach(p => p.remove());
            for (let i = 0; i < 4; i++) {
                const p = this.doc.createElement('div');
                p.className = 'tutorial-shade tutorial-shade-part';
                p.setAttribute('data-tutorial-shade-part', '');
                this._root.insertBefore(p, ring);
            }
            panels = this._root.querySelectorAll('[data-tutorial-shade-part]');
        }
        const parts = [
            { l: 0, t: 0, w: vw, h: top },
            { l: 0, t: top + height, w: vw, h: Math.max(0, vh - top - height) },
            { l: 0, t: top, w: left, h: height },
            { l: left + width, t: top, w: Math.max(0, vw - left - width), h: height }
        ];
        parts.forEach((p, i) => {
            panels[i].style.display = 'block';
            panels[i].style.left = p.l + 'px';
            panels[i].style.top = p.t + 'px';
            panels[i].style.width = p.w + 'px';
            panels[i].style.height = p.h + 'px';
        });

        // Карточка не должна закрывать подсвеченный элемент.
        const cardHeight = card.offsetHeight || 190;
        const cardWidth = Math.min(360, Math.max(260, vw - 24));
        card.style.width = cardWidth + 'px';
        card.style.transform = 'none';
        card.style.left = Math.max(12, Math.min(vw - cardWidth - 12, left + width / 2 - cardWidth / 2)) + 'px';
        if (top + height / 2 > vh / 2) {
            card.style.top = Math.max(12, top - cardHeight - 14) + 'px';
            card.style.bottom = 'auto';
        } else {
            card.style.top = Math.min(vh - cardHeight - 12, top + height + 14) + 'px';
            card.style.bottom = 'auto';
        }
    }

    // ============ Events ============
    _onDocumentClick = (event) => {
        if (!this.scenario || this.waiting || this._targetLocked) return;
        const scenario = this.scenarios[this.scenario];
        const step = scenario.steps[this.index];
        if (!step || !step.target) return;
        const target = this.doc.querySelector(step.target);
        if (!target || !target.contains(event.target)) return;
        // Шаги с advanceOn ждут игрового события: даём открыть модалку и скрываем оверлей.
        if (step.advanceOn) {
            this._hideUi();
            return;
        }
        this._targetLocked = true;
        this.win.setTimeout(() => {
            this._targetLocked = false;
            if (this.scenario) this.next();
        }, 0);
    };

    _removeListeners() {
        this.doc.removeEventListener('click', this._onDocumentClick, true);
        if (this.win && this.win.removeEventListener) this.win.removeEventListener('resize', this._resizeHandler);
    }

    _markDone(scenario) {
        const flag = TUTORIAL_FLAGS[scenario];
        if (!flag) return;
        const settings = this.getSettings();
        if (!settings) return;
        settings[flag] = true;
        this.saveSettings();
    }

    _finish(reason) {
        const scenario = this.scenario;
        this._hideUi();
        this._removeListeners();
        this.scenario = null;
        this.index = 0;
        this.waiting = false;
        if (this.onFinish) this.onFinish({ scenario, reason });
    }
}
