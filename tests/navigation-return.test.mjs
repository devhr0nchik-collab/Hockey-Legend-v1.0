// ============================================================
// QA v1.2: возврат навигации из карточки игрока.
// Критический сценарий: Президент -> Состав -> Игрок -> Назад -> хаб президента.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const HL = () => window.__HL;

beforeAll(async () => {
    try { localStorage.setItem('hockeyLegendLang', 'ru'); } catch (e) {}
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
    }));
    const body = INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');
    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../src/features/president/events.js');
    await import('../script.js');
    await import('../datapack.js');
    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'QA Nav';
    document.getElementById('ca-agency').value = 'QA Navigation Agency';
    document.getElementById('ca-start').click();
});

describe('Возврат из карточки игрока', () => {
    it('президент: состав -> игрок -> Назад возвращает в хаб президента', () => {
        const club = HL().presidentBecomeForTest('ICE_HL');
        expect(club).not.toBeNull();

        document.querySelector('[data-action="infrastructure"]').click();
        expect(HL().navProbe().screen).toBe('club-hub-screen');

        document.querySelector('#club-hub-screen [data-chub="roster"]').click();
        const row = document.querySelector('#club-hub-content .roster-row');
        expect(row).toBeTruthy();

        row.click();
        expect(HL().navProbe().screen).toBe('player-screen');

        document.getElementById('player-back').click();
        const nav = HL().navProbe();
        expect(nav.screen).toBe('club-hub-screen');
        expect(nav.clubHubTab).toBe('roster');
        expect(document.getElementById('office-screen').style.display).toBe('none');
    });

    it('публичный хаб: состав -> игрок -> Назад сохраняет хаб, вкладку и экран-источник', () => {
        const club = HL().presidentBecomeForTest('ICE_HL');
        expect(club).not.toBeNull();

        expect(HL().openPublicClubHubForTest(club.club, club.league, 'office-screen')).toBe('public-club-hub-screen');
        document.querySelector('#pch-tabs [data-ptab2="roster"]').click();
        const row = document.querySelector('#pch-content [data-pch-player]');
        expect(row).toBeTruthy();

        row.click();
        expect(HL().navProbe().screen).toBe('player-screen');

        document.getElementById('player-back').click();
        const nav = HL().navProbe();
        expect(nav.screen).toBe('public-club-hub-screen');
        expect(nav.pchTab).toBe('roster');
        expect(nav.pchReturnScreen).toBe('office-screen');

        document.getElementById('pch-back').click();
        expect(HL().navProbe().screen).toBe('office-screen');
    });
});
