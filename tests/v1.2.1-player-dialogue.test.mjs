// ============================================================
// v1.2.1 «Единое окно игрока»:
// ребаланс скаутинга, вкладка «Диалог» и информационные агентства.
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

    localStorage.setItem('hockeyLegendLang', 'ru');
    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Диалог v121';
    document.getElementById('ca-agency').value = 'Dialogue Agency';
    document.getElementById('ca-start').click();
});

const HL = () => window.__HL;

function closePlayerDialogueModal() {
    const modal = document.getElementById('player-dialogue-modal');
    if (modal) modal.style.display = 'none';
}

describe('v1.2.1: ребаланс скаутинга', () => {
    it('Скаутинг 1 уровня не генерирует игроков с рейтингом > 55', () => {
        HL().setAgentLevel(30);
        HL().setScoutingLevelForTest(1);
        expect(HL().scoutingRangeProbe().max).toBeLessThanOrEqual(55);

        HL().setSeed(4242);
        for (let window = 0; window < 4; window++) {
            const pool = HL().generateFreeAgentWindow(30);
            expect(pool.length).toBeGreaterThan(0);
            for (const p of pool) {
                expect(p.rating).toBeLessThanOrEqual(55);
                expect(p.rating).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('сильные таланты 70+ открываются только прокачанным скаутингом', () => {
        HL().setScoutingLevelForTest(1);
        const low = HL().scoutingRangeProbe();
        expect(low.max).toBeLessThan(70);

        HL().setScoutingLevelForTest(20);
        const high = HL().scoutingRangeProbe();
        expect(high.max).toBeGreaterThanOrEqual(70);
        expect(high.max).toBeLessThanOrEqual(88);
    });
});

describe('v1.2.1: вкладка «Диалог» в карточке игрока', () => {
    it('у свободного агента есть кнопка «Предложить контракт»', () => {
        const name = 'Свободный Тест v121';
        HL().createTestFreeAgent(name, 50);
        HL().openPlayerForTest(name, 'search');
        HL().setPlayerTabForTest('dialogue');

        const tab = document.querySelector('.player-tab[data-ptab="dialogue"]');
        expect(tab).toBeTruthy();
        expect(tab.classList.contains('active')).toBe(true);

        const btn = document.getElementById('player-dialogue-offer-btn');
        expect(btn).toBeTruthy();
        expect(btn.textContent).toContain('Предложить контракт');
        expect(document.getElementById('player-dialogue-poach-btn')).toBeNull();
    });

    it('у игрока чужого агентства есть кнопка «Переманить»', () => {
        const name = 'Чужой Тест v121';
        HL().createTestAgencyPlayer(name, 0, 72);
        HL().openPlayerForTest(name, 'public');
        HL().setPlayerTabForTest('dialogue');

        const btn = document.getElementById('player-dialogue-poach-btn');
        expect(btn).toBeTruthy();
        expect(btn.textContent).toContain('Переманить');
        expect(document.getElementById('player-dialogue-offer-btn')).toBeNull();
        expect(document.querySelector('.dlg-rep-compare')).toBeTruthy();
    });

    it('у своего клиента видны условия и кнопка «Разорвать контракт»', () => {
        const name = 'Мой Клиент v121';
        HL().addClient(name);
        HL().openPlayerForTest(name, 'my');
        HL().setPlayerTabForTest('dialogue');

        const btn = document.getElementById('player-dialogue-release-btn');
        expect(btn).toBeTruthy();
        expect(btn.textContent).toContain('Разорвать контракт');
        expect(document.querySelector('.dlg-contract-card')).toBeTruthy();
    });

    it('мини-диалог открывает ползунок подъёмных и обещания', () => {
        const name = 'Свободный Диалог v121';
        HL().createTestFreeAgent(name, 48);
        HL().openPlayerForTest(name, 'search');
        HL().setPlayerTabForTest('dialogue');

        document.getElementById('player-dialogue-offer-btn').click();
        expect(document.getElementById('player-dialogue-modal').style.display).toBe('flex');
        expect(document.getElementById('dlg-bonus-slider')).toBeTruthy();
        expect(document.querySelectorAll('.dlg-promise').length).toBeGreaterThanOrEqual(3);
        closePlayerDialogueModal();
    });
});

describe('v1.2.1: шанс переманивания', () => {
    it('шанс жёстко растёт с разницей репутаций', () => {
        const name = 'Шанс Тест v121';
        HL().createTestAgencyPlayer(name, 0, 70);
        const low = HL().dialoguePoachChanceProbe(name, 90, 0, [], 10);
        const high = HL().dialoguePoachChanceProbe(name, 30, 0, [], 90);
        expect(high).toBeGreaterThan(low);
        expect(low).toBeGreaterThanOrEqual(5);
        expect(high).toBeLessThanOrEqual(90);
    });
});

describe('v1.2.1: экран агентств только информирует', () => {
    it('карточка NPC-агентства не содержит кнопок переманивания', () => {
        const modal = HL().openNpcAgencyForTest(0);
        expect(modal).toBeTruthy();
        expect(modal.body).toContain('npc-agency-header');
        expect(modal.body).toContain('npc-client-row');
        expect(modal.body).not.toContain('ncr-action');
        expect(modal.body).not.toContain('Попыток переманить');
        expect(modal.actions).toContain('Закрыть');
        expect(INDEX_HTML).not.toContain('poach-dialog-modal');
        expect(INDEX_HTML).toContain('player-dialogue-modal');
        document.getElementById('npc-agency-modal').style.display = 'none';
    });
});
