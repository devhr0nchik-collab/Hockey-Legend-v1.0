// ============================================================
// Этап 3.1: глобальная настройка просмотра матчей.
// full / score / off, сохранение в localStorage, коллбеки очереди.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const SETTINGS_KEY = 'hockeyLegendSettings';
const HL = () => window.__HL;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
    document.getElementById('ca-name').value = 'Настройки Матчей';
    document.getElementById('ca-agency').value = 'View Agency';
    document.getElementById('ca-start').click();
});

describe('3.1 Просмотр матчей: настройка и localStorage', () => {
    it('по умолчанию full; старые настройки без поля получают full', () => {
        localStorage.removeItem(SETTINGS_KEY);
        expect(HL().reloadSettingsNow().mode).toBe('full');
        expect(HL().matchViewSettings().shouldOpen).toBe(true);

        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sound: true, vibration: false }));
        expect(HL().reloadSettingsNow().mode).toBe('full');
    });

    it('настройка сохраняется и загружается из localStorage', () => {
        HL().setMatchViewSetting('score');
        expect(HL().matchViewSettings().mode).toBe('score');
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        expect(saved.matchView).toBe('score');

        HL().reloadSettingsNow();
        expect(HL().matchViewSettings().mode).toBe('score');

        HL().setMatchViewSetting('off');
        HL().reloadSettingsNow();
        expect(HL().matchViewSettings().mode).toBe('off');
        expect(HL().matchViewSettings().shouldOpen).toBe(false);
    });

    it('переключатели в модалке настроек отражают режим', () => {
        HL().setMatchViewSetting('score');
        expect(document.getElementById('setting-match-view-score').checked).toBe(true);
        expect(document.getElementById('setting-match-view-full').checked).toBe(false);
        HL().setMatchViewSetting('off');
        expect(document.getElementById('setting-match-view-off').checked).toBe(true);
    });
});

describe('3.1 Просмотр матчей: политика очередей', () => {
    it('full: экран открыт, воспроизведение не перемотано', () => {
        let calls = 0;
        const st = HL().openMatchQueueForTest('full', 1, () => calls++);
        expect(st.screen).toBe('flex');
        expect(st.finished).toBe(false);
        expect(calls).toBe(0);
        HL().closeMatchViewNow();
        expect(calls).toBe(1);
    });

    it('off: экран не открывается, матчи viewed, onFinish вызван ровно один раз', () => {
        let calls = 0;
        const st = HL().openMatchQueueForTest('off', 3, () => calls++);
        expect(st.screen).not.toBe('flex');
        expect(st.viewed).toEqual([true, true, true]);
        expect(st.hasQueue).toBe(false);
        expect(st.left).toBe(0);
        expect(calls).toBe(1);
    });

    it('off через openMatchQueue (путь президента) не оставляет очередь', () => {
        const st = HL().openMatchQueueForTest('off', 2, null, 'open');
        expect(st.screen).not.toBe('flex');
        expect(st.viewed).toEqual([true, true]);
        expect(st.hasQueue).toBe(false);
    });

    it('score: экран открыт сразу на финальном счёте, callback после закрытия', () => {
        let calls = 0;
        const st = HL().openMatchQueueForTest('score', 1, () => calls++);
        expect(st.screen).toBe('flex');
        expect(st.finished).toBe(true);
        expect(calls).toBe(0);
        HL().closeMatchViewNow();
        expect(calls).toBe(1);
    });

    it('off: неделя президента не открывает match-view-screen', async () => {
        HL().setMatchViewSetting('off');
        HL().setPhaseForTest('regular', 0);
        const key = HL().clubKeysForTest().find(k => k.startsWith('NHL_'));
        HL().setPresidentForTest(key, 60);
        HL().advanceWeek();
        await sleep(700);
        const screen = document.getElementById('match-view-screen');
        expect(screen.style.display).not.toBe('flex');
    });

    it('off: финал плей-офф всё равно вызывает finishPlayoffs → фаза draft', () => {
        const st = HL().openPlayoffFinalQueueForTest('off');
        expect(st.phase).toBe('draft');
        expect(st.screen).not.toBe('flex');
    });

    it('off: матчи сборной не открывают экран и не теряют proceedAfterMatches', async () => {
        HL().setMatchViewSetting('off');
        HL().setPhaseForTest('world_champ', 0);
        expect(HL().startTournamentNow()).toBe(true);
        HL().addPendingNtMatchForTest();
        HL().tournamentWeekNow();
        await sleep(500);
        expect(document.getElementById('match-view-screen').style.display).not.toBe('flex');
    });
});
