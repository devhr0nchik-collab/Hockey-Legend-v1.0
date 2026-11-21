// ============================================================
// Этап 1.3 плейтест-плана: сброс выбранной сборной.
// clearFavoriteNationalTeam, кнопка в модалке и настройках,
// save/load null, отсутствие очереди матчей после сброса.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
localStorage.setItem('hockeyLegendLang', 'ru'); // jsdom navigator.language = en → форсируем RU

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
    document.getElementById('ca-name').value = 'Сборная Тест';
    document.getElementById('ca-agency').value = 'NT Agency';
    document.getElementById('ca-start').click();
});

describe('1.3 сборная: выбор и сброс', () => {
    it('выбрали сборную → сброс из модалки → null, save/load сохраняет null', async () => {
        expect(window.__HL.startTournamentNow()).toBe(true);
        window.__HL.setFavoriteForTest('RU');
        expect(window.__HL.ntState().favorite).toBe('RU');

        // Модалка открыта, кнопка сброса видна и называется «Сбросить выбор».
        expect(window.__HL.openNtPickModalNow()).toBe('flex');
        const skip = document.querySelector('#nt-pick-actions .nt-pick-skip');
        expect(skip).toBeTruthy();
        expect(skip.textContent).toContain('Сбросить выбор');
        skip.click();

        expect(window.__HL.ntState().favorite).toBeNull();
        expect(window.__HL.ntState().pending).toBe(0);

        await window.__HL.saveGame();
        await new Promise((r) => setTimeout(r, 100));
        const ok = await window.__HL.loadGame();
        expect(ok).toBe(true);
        expect(window.__HL.ntState().favorite).toBeNull();
    });

    it('сброс из настроек вне турнира работает', async () => {
        // Завершаем турнир и выбираем сборную «на будущее».
        window.__HL.finishTournamentNow();
        expect(window.__HL.ntState().hasTournament).toBe(false);
        window.__HL.setFavoriteForTest('CA');

        document.getElementById('btn-settings').click(); // loadSettings рисует строку
        const val = document.getElementById('setting-nt-value');
        expect(val.textContent).toContain('Канада');
        const btn = document.getElementById('setting-nt-reset');
        expect(btn.style.display).not.toBe('none');
        btn.click();

        expect(window.__HL.ntState().favorite).toBeNull();
        expect(document.getElementById('setting-nt-value').textContent).toContain('не выбрана');
        document.getElementById('btn-settings-close').click();
    });

    it('модалка открывается без турнира и сбрасывает выбор', () => {
        window.__HL.setFavoriteForTest('SE');
        expect(window.__HL.ntState().hasTournament).toBe(false);
        expect(window.__HL.openNtPickModalNow()).toBe('flex');
        const skip = document.querySelector('#nt-pick-actions .nt-pick-skip');
        expect(skip).toBeTruthy();
        skip.click();
        expect(window.__HL.ntState().favorite).toBeNull();
    });

    it('после сброса playTournamentWeek не ставит матчи в очередь', () => {
        expect(window.__HL.startTournamentNow()).toBe(true);
        window.__HL.setFavoriteForTest('RU');
        // Отложенный матч выбранной сборной есть.
        window.__HL.addPendingNtMatchForTest();
        expect(window.__HL.ntState().pending).toBeGreaterThan(0);
        // Сброс очищает _pendingMatches.
        window.__HL.clearFavoriteNow();
        expect(window.__HL.ntState().pending).toBe(0);

        // Неделя турнира без выбранной сборной: очередь не создаётся.
        window.__HL.setSeed(7701);
        window.__HL.tournamentWeekNow();
        expect(window.__HL.matchQueueSize()).toBe(0);
        expect(window.__HL.ntState().pending).toBe(0);
    });

    it('бар турнира: кнопка СБРОСИТЬ рядом со СМЕНИТЬ', () => {
        window.__HL.setFavoriteForTest('RU');
        const html = window.__HL.ntFavBarNow();
        expect(html).toContain('nt-fav-change');
        expect(html).toContain('nt-fav-reset');
        document.getElementById('nt-fav-reset').click();
        expect(window.__HL.ntState().favorite).toBeNull();
    });
});