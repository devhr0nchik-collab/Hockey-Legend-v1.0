// ============================================================
// v1.3: Зал Славы агентства, лиговые рекорды, достижения.
// Проверяем данные (без PackedPlayer), обновление в конце сезона,
// снимки клиентов, ретро-ачивки, save/load и NEON RINK UI.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const STYLE_CSS = readFileSync(join(process.cwd(), 'style.css'), 'utf8');
const CLIENT = 'Hall Test Client';
const GOALIE = 'Hall Test Goalie';

let LANG = null;

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
    LANG = (await import('../i18n.js')).LANG;

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Hall Agent';
    document.getElementById('ca-agency').value = 'Hall Agency';
    document.getElementById('ca-start').click();

    window.__HL.addClient(CLIENT, 'C');
    window.__HL.addClient(GOALIE, 'G');
});

const HL = () => window.__HL;

describe('v1.3: лиговые рекорды', () => {
    it('виртуальная история есть для всех 13 лиг и всех 5 таблиц', () => {
        HL().seedLeagueRecordsForTest();
        const recs = HL().leagueRecordsProbe();
        expect(Object.keys(recs).length).toBe(13);
        for (const lk of Object.keys(recs)) {
            expect(recs[lk].cats.goals.length).toBeGreaterThan(0);
            expect(recs[lk].cats.assists.length).toBeGreaterThan(0);
            expect(recs[lk].cats.points.length).toBeGreaterThan(0);
            expect(recs[lk].cats.goalie.shutouts.length).toBeGreaterThan(0);
            expect(recs[lk].cats.goalie.saves.length).toBeGreaterThan(0);
        }
    });

    it('обновление в конце сезона: топ-10, клуб, сезон, очки', () => {
        HL().seedLeagueRecordsForTest();
        HL().setPlayerSeasonStatsForTest(CLIENT, {
            gp: 82, goals: 99, assists: 90, club: 'Hall Club', league: 'NHL'
        });
        HL().updateLeagueRecordsNow(true);
        const rec = HL().leagueRecordsProbe('NHL');
        expect(rec.updatedSeason).toBe(HL().getState().currentSeason);
        expect(rec.cats.goals[0]).toMatchObject({ name: CLIENT, value: 99, club: 'Hall Club' });
        expect(rec.cats.assists[0]).toMatchObject({ name: CLIENT, value: 90 });
        expect(rec.cats.points[0]).toMatchObject({ name: CLIENT, value: 189 });
        expect(rec.cats.goals.length).toBeLessThanOrEqual(10);
    });

    it('рекорд только улучшается и не откатывается вниз', () => {
        HL().setPlayerSeasonStatsForTest(CLIENT, {
            gp: 20, goals: 5, assists: 3, club: 'Hall Club', league: 'NHL'
        });
        HL().updateLeagueRecordsNow(true);
        const row = HL().leagueRecordsProbe('NHL').cats.goals.find(r => r.name === CLIENT);
        expect(row.value).toBe(99);
    });

    it('вратари: сухие игры главнее, сейвы отдельной таблицей', () => {
        HL().setPlayerSeasonStatsForTest(GOALIE, {
            gp: 70, goals: 0, assists: 0, goalsAgainst: 120, club: 'Hall Club', league: 'NHL'
        });
        HL().setGoalieSeasonStatsForTest(GOALIE, { gp: 70, saves: 9000, shutouts: 40 });
        HL().updateLeagueRecordsNow(true);
        const rec = HL().leagueRecordsProbe('NHL');
        expect(rec.cats.goalie.shutouts[0]).toMatchObject({ name: GOALIE, value: 40 });
        expect(rec.cats.goalie.saves[0]).toMatchObject({ name: GOALIE, value: 9000 });
    });

    it('игрок видит своих клиентов в таблицах рекордов', () => {
        HL().syncAgencyHallNow();
        const html = HL().hallScreenHTMLForTest('leagues', 'NHL');
        expect(html).toContain(CLIENT);
        expect(html).toContain('is-client');
        expect(html).toContain('ВАШ КЛИЕНТ');
        expect(html).toContain('hlf-record-row');
    });
});

describe('v1.3: Зал Славы агентства', () => {
    it('снимок карьеры сохраняется при уходе клиента', () => {
        HL().setPlayerSeasonStatsForTest(CLIENT, {
            gp: 82, goals: 41, assists: 59, club: 'Hall Club', league: 'NHL'
        });
        HL().syncAgencyHallNow();
        let entry = HL().hallEntryProbe(CLIENT);
        expect(entry).toMatchObject({ status: 'active', goals: 41, assists: 59, points: 100 });
        expect(entry.legacy).toBeGreaterThan(0);

        expect(HL().removeClientNow(CLIENT)).toBe(true);
        entry = HL().hallEntryProbe(CLIENT);
        expect(entry.status).toBe('released');
        expect(entry.goals).toBe(41);
        expect(entry.points).toBe(100);
        expect(entry.name).toBe(CLIENT);
    });

    it('экран агентства показывает карточки и легаси', () => {
        const html = HL().hallScreenHTMLForTest('agency');
        expect(html).toContain('hlf-client-row');
        expect(html).toContain('hlf-podium');
        expect(html).toContain(CLIENT);
        expect(html).toContain('легаси');
    });

    it('карточка клиента открывает и закрывает модалку карьеры', () => {
        HL().setHallTabForTest('agency');
        const row = document.querySelector('#hall-content .hlf-client-row');
        expect(row).toBeTruthy();
        row.click();
        const modal = document.getElementById('hall-client-modal');
        expect(modal.style.display).toBe('flex');
        expect(document.getElementById('hall-client-body').innerHTML).toContain('hlf-modal-stats');
        document.getElementById('hall-client-close').click();
        expect(modal.style.display).toBe('none');
    });
});

describe('v1.3: достижения', () => {
    it('каталог: 30–40 ачивок, уникальные id, все категории', () => {
        const catalog = HL().achievementCatalogProbe();
        expect(catalog.length).toBeGreaterThanOrEqual(30);
        expect(catalog.length).toBeLessThanOrEqual(40);
        expect(new Set(catalog.map(a => a.id)).size).toBe(catalog.length);
        const cats = new Set(catalog.map(a => a.cat));
        ['money', 'career', 'league', 'trophies', 'intrigue', 'legacy'].forEach(c => {
            expect(cats.has(c)).toBe(true);
        });
        expect(catalog.every(a => a.target > 0)).toBe(true);
    });

    it('ретро-активны: деньги и рекорды открываются, но не дублируются', () => {
        HL().resetAchievementsForTest();
        HL().setMoneyForTest(1000000);
        const first = HL().checkAchievementsNow();
        expect(first).toContain('money_10k');
        expect(first).toContain('money_1m');
        expect(first).toContain('record_debut');
        expect(first).toContain('sniper_king');
        expect(HL().achievementValueProbe('money_1m')).toBe(1000000);

        const count = Object.keys(HL().achievementsProbe().unlocked).length;
        const second = HL().checkAchievementsNow();
        expect(second).toEqual([]);
        expect(Object.keys(HL().achievementsProbe().unlocked).length).toBe(count);
    });

    it('денежные награды ачивок не превышают $50K, слотов нет', () => {
        const catalog = HL().achievementCatalogProbe();
        expect(catalog.length).toBeGreaterThan(0);
        expect(catalog.every(a => a.money <= 50000)).toBe(true);
        expect(catalog.some(a => a.xp > 0 || a.rep > 0 || a.money > 0)).toBe(true);
        const html = HL().hallScreenHTMLForTest('achievements');
        expect(html).toContain('hlf-ach-card');
        expect(html).toContain('hlf-ach-hero');
    });

    it('экран достижений показывает прогресс и фильтры', () => {
        HL().setHallTabForTest('achievements');
        const count = Object.keys(HL().achievementsProbe().unlocked).length;
        const total = HL().achievementCatalogProbe().length;
        const counter = document.getElementById('hall-ach-count');
        expect(counter.textContent).toBe(`${count}/${total}`);
        const html = HL().hallScreenHTMLForTest('achievements', null);
        expect(html).toContain('hlf-ach-filters');
        expect(html).toContain('hlf-ach-grid');
        expect(html).toContain('Получено');
    });
});

describe('v1.3: сейв и совместимость', () => {
    it('рекорды, Зал Славы и достижения переживают save → load', async () => {
        HL().updateLeagueRecordsNow(true);
        HL().syncAgencyHallNow();
        await HL().saveGame();
        await new Promise(r => setTimeout(r, 100));

        HL().resetGame();
        expect(HL().agencyHallProbe().entries.length).toBe(0);
        expect(Object.keys(HL().achievementsProbe().unlocked).length).toBe(0);

        const ok = await HL().loadGame();
        expect(ok).toBe(true);
        const rec = HL().leagueRecordsProbe('NHL');
        expect(rec.cats.goals.some(r => r.name === CLIENT && r.value === 99)).toBe(true);
        expect(rec.cats.goalie.shutouts.some(r => r.name === GOALIE && r.value === 40)).toBe(true);
        expect(HL().agencyHallProbe().entries.some(e => e.name === CLIENT && e.status === 'released')).toBe(true);
        expect(HL().achievementsProbe().unlocked.record_debut).toBeTruthy();
    });

    it('resetGame очищает историю и заново сеет рекорды', () => {
        HL().resetGame();
        expect(HL().agencyHallProbe().entries.length).toBe(0);
        expect(Object.keys(HL().achievementsProbe().unlocked).length).toBe(0);
        const recs = HL().leagueRecordsProbe();
        expect(Object.keys(recs).length).toBe(13);
        expect(recs.NHL.cats.goals.length).toBeGreaterThan(0);
    });
});

describe('v1.3: UI, стили и локализация', () => {
    it('вкладки Зала Славы, плитка офиса и NEON RINK классы на месте', () => {
        expect(INDEX_HTML).toContain('id="hall-of-fame-screen"');
        expect(INDEX_HTML).toContain('data-htab="agency"');
        expect(INDEX_HTML).toContain('data-htab="leagues"');
        expect(INDEX_HTML).toContain('data-htab="achievements"');
        expect(INDEX_HTML).toContain('data-action="hall"');
        expect(INDEX_HTML).toContain('id="hall-client-modal"');
        expect(STYLE_CSS).toContain('.hlf-client-row');
        expect(STYLE_CSS).toContain('.hlf-record-row');
        expect(STYLE_CSS).toContain('.hlf-ach-card');
        expect(STYLE_CSS).toContain('.hlf-podium');
    });

    it('EN-переводы есть для новых экранов и достижений', () => {
        expect(LANG).toBeTruthy();
        LANG.set('en');
        expect(LANG.t('Зал Славы')).toBe('Hall of Fame');
        expect(LANG.t('ВАШ КЛИЕНТ')).toBe('YOUR CLIENT');
        expect(LANG.t('Первый миллион')).toBe('First Million');
        expect(LANG.t('Гроза авторитетов')).toBe('Rival Wrecker');
        expect(LANG.t('Лучшие вратари: сухие игры')).toBe('Top Goalies: Shutouts');
        LANG.set('ru');
    });
});
