// ============================================================
// Этап 1.2 плейтест-плана: цепочка home_return_chain и family_home.
// canStart, привязка игрока (getChainPlayer), корректное закрытие,
// отсутствие дублей задач find_club_home.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
localStorage.setItem('hockeyLegendLang', 'ru'); // jsdom navigator.language = en → форсируем RU
const clubOf = (lk) => window.__HL.clubKeysForTest().find(k => k.startsWith(lk + '_')).split('_').slice(1).join('_');

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
    document.getElementById('ca-name').value = 'Дом Тест';
    document.getElementById('ca-agency').value = 'Home Agency';
    document.getElementById('ca-start').click();
});

describe('1.2 цепочки: старт и привязка игрока', () => {
    it('все клиенты дома — home_return_chain не стартует, family_home не появляется', () => {
        window.__HL.addClient('Дом Клиент');
        // 🇨🇦 + NHL = дома (isInHomeCountry true).
        const st = window.__HL.setPlayerClubForTest('Дом Клиент', 'NHL', clubOf('NHL'), '🇨🇦');
        expect(st.inHome).toBe(true);

        const chains = window.__HL.triggerChainStartNow('home_return_chain');
        expect(chains.some(c => c.chainId === 'home_return_chain')).toBe(false);

        const probe = window.__HL.eventPoolProbe('family_home');
        expect(probe.condition).toBe(false);
        expect(probe.playerName).toBeNull();
    });

    it('клиент за границей — цепочка стартует и привязывает именно его', () => {
        window.__HL.addClient('За Границей');
        window.__HL.setPlayerClubForTest('За Границей', 'NHL', clubOf('NHL'), '🇷🇺'); // RU + NHL → не дома
        const chains = window.__HL.triggerChainStartNow('home_return_chain');
        const ac = chains.find(c => c.chainId === 'home_return_chain');
        expect(ac).toBeTruthy();
        expect(ac.playerName).toBe('За Границей');

        const probe = window.__HL.eventPoolProbe('family_home');
        expect(probe.condition).toBe(true);
        expect(probe.playerName).toBe('За Границей');
    });

    it('стадия берёт привязанного игрока, даже если другой eligible стоит первым в ростере', () => {
        window.__HL.addClient('Другой За Границей');
        window.__HL.setPlayerClubForTest('Другой За Границей', 'NHL', clubOf('NHL'), '🇷🇺');
        // Ставим другого ПЕРВЫМ — старый код подменил бы привязанного.
        window.__HL.rosterReorderForTest('Другой За Границей');

        window.__HL.setChainStageForTest('home_return_chain', 1);
        window.__HL.setSeed(5500);
        const shown = window.__HL.chainTickNow();
        expect(shown).toBe(true);
        const text = document.getElementById('event-text').innerHTML;
        expect(text).toContain('За Границей');
        expect(text).not.toContain('Другой За Границей');
        // Закрываем стадию: выбор → OK.
        document.querySelector('#event-actions .event-choice-btn').click();
        document.querySelector('#event-actions .btn-neutral').click();
        const ac = window.__HL.chainState().find(c => c.chainId === 'home_return_chain');
        expect(ac.stage).toBe(2);
        expect(ac.playerName).toBe('За Границей');
    });

    it('игрок вернулся домой между стадиями — цепочка закрыта, лояльность цела, чужие не тронуты', () => {
        const before = window.__HL.playerLoyaltyProbe('За Границей');
        window.__HL.setPlayerClubForTest('За Границей', 'KHL', clubOf('KHL')); // RU + KHL = дома
        window.__HL.setChainStageForTest('home_return_chain', 2);

        const shown = window.__HL.chainTickNow();
        expect(shown).toBe(false);
        expect(window.__HL.chainState().some(c => c.chainId === 'home_return_chain')).toBe(false);
        expect(window.__HL.playerLoyaltyProbe('За Границей')).toBe(before);
        expect(window.__HL.playerContractProbe('Другой За Границей').inRoster).toBe(true);
        const news = JSON.parse(window.__HL.weekSnapshot()).news.map(n => n[0]);
        expect(news.some(t => t.includes('История закрыта'))).toBe(true);
    });
});

describe('1.2 family_home: без дублей задач', () => {
    it('повторное обещание не создаёт вторую задачу find_club_home', () => {
        window.__HL.addClient('Дубль Тест');
        window.__HL.setPlayerClubForTest('Дубль Тест', 'NHL', clubOf('NHL'), '🇷🇺');
        // Убираем чужую eligible-цель, чтобы getPlayer выбрал именно Дубль Тест.
        window.__HL.setPlayerClubForTest('Другой За Границей', 'KHL', clubOf('KHL'));
        window.__HL.setSeed(6600);
        expect(window.__HL.eventChoiceForPlayerNow('family_home', 0, 'Дубль Тест')).toBe(true);
        expect(window.__HL.homeTasksFor('Дубль Тест').length).toBe(1);

        expect(window.__HL.eventChoiceForPlayerNow('family_home', 0, 'Дубль Тест')).toBe(true);
        expect(window.__HL.homeTasksFor('Дубль Тест').length).toBe(1);
    });

    it('задача выполнена (игрок дома) — цепочка закрыта, кулдаун не даёт перезапуск', () => {
        // Чистим прошлые задачи/цепочки сценария: Дубль Тест уже дома.
        window.__HL.setPlayerClubForTest('Дубль Тест', 'KHL', clubOf('KHL'));
        window.__HL.checkTasksNow();

        window.__HL.addClient('Финиш Дом');
        window.__HL.setPlayerClubForTest('Финиш Дом', 'NHL', clubOf('NHL'), '🇷🇺');
        window.__HL.clearChainCooldownForTest('home_return_chain'); // изоляция от кулдауна прошлого теста
        window.__HL.triggerChainStartNow('home_return_chain');
        const ac = window.__HL.chainState().find(c => c.chainId === 'home_return_chain');
        expect(ac).toBeTruthy();
        expect(ac.playerName).toBe('Финиш Дом');

        window.__HL.eventChoiceForPlayerNow('family_home', 0, 'Финиш Дом');
        expect(window.__HL.homeTasksFor('Финиш Дом').length).toBe(1);

        window.__HL.setPlayerClubForTest('Финиш Дом', 'KHL', clubOf('KHL'));
        window.__HL.checkTasksNow();

        expect(window.__HL.homeTasksFor('Финиш Дом').length).toBe(0);
        expect(window.__HL.chainState().some(c => c.chainId === 'home_return_chain')).toBe(false);
        // Немедленный перезапуск заблокирован кулдауном.
        const chains = window.__HL.triggerChainStartNow('home_return_chain');
        expect(chains.some(c => c.chainId === 'home_return_chain')).toBe(false);
    });
});