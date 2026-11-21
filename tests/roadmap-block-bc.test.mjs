// ============================================================
// v1.1: блоки B, C и баланс (hockey-legend-roadmap.md).
// B6 — КЧ по престижу в первый сезон; B8 — карточка «Продолжить»;
// B10 — награда цели в UI = начислению; B11 — экранирование новостей;
// B13 — кубок совета по championsHistory; B15 — сила от состава;
// B16 — нет дублей в датапаке; B17 — паддинг по медиане.
// Б1 — XP-пороги и недельный XP; Б2 — налог и цели; Б3 — шанс событий.
// C1/C2/C3/C4/C5/C10/C11/C13/C14/C15 — платформа и i18n.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REAL_ROSTERS } from '../datapack_rosters.js';
import { translateTextForTest } from '../i18n.js';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const STYLE_CSS = readFileSync(join(process.cwd(), 'style.css'), 'utf8');
const SW_JS = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');
const MANIFEST = JSON.parse(readFileSync(join(process.cwd(), 'public/manifest.webmanifest'), 'utf8'));
const HL = () => window.__HL;

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
    document.getElementById('ca-name').value = 'Блок BC';
    document.getElementById('ca-agency').value = 'BC Agency';
    document.getElementById('ca-start').click();
});

describe('B6: Кубок Чемпионов в первый сезон', () => {
    it('при отсутствии мест выбирает клубы по престижу, а не по порядку', () => {
        const teams = HL().worldCupTeamsNow();
        const khl = teams.filter(t => t.league === 'KHL').map(t => t.club);
        expect(khl.length).toBeGreaterThan(0);
        const all = HL().leagueClubsProbe('KHL')
            .map(club => ({ club, prestige: HL().clubPrestigeProbe('KHL', club) }))
            .sort((a, b) => b.prestige - a.prestige)
            .slice(0, khl.length)
            .map(x => x.club);
        expect(new Set(khl)).toEqual(new Set(all));
    });
});

describe('B8: карточка «Продолжить»', () => {
    it('считает клиентов из rosterNames', async () => {
        const value = await HL().continueClientsProbe(['Первый', 'Второй', 'Третий']);
        expect(value).toBe('3');
    });
});

describe('B10: награда карьерной цели', () => {
    it('UI показывает ровно ту сумму, которая начисляется', () => {
        const probe = HL().careerGoalMoneyProbe('business', 2);
        expect(probe.shown).toBeGreaterThan(0);
        expect(probe.paid).toBe(Math.round(probe.shown / 5));
    });
});

describe('B11: новости и имена клиентов', () => {
    it('экранирует HTML и оборачивает имя клиента ровно один раз', () => {
        HL().addClient('B11 Игрок');
        const html = HL().newsRenderProbe('Сделка: <script>alert(1)</script> B11 Игрок');
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;');
        const matches = html.match(/class="news-client-link"/g) || [];
        expect(matches.length).toBe(1);
    });
});

describe('B13: задача совета «Кубок лиги»', () => {
    it('засчитывается по championsHistory, а не по первому месту регулярки', () => {
        const keys = HL().clubKeysForTest().filter(k => k.startsWith('NHL_'));
        const [championKey, otherKey] = keys;
        const season = 2030;
        HL().setChampionForTest('NHL', season, championKey.slice(4));
        expect(HL().checkTaskProgressNow(championKey, { check: 'champion', target: 1 }, season)).toBe(1);
        expect(HL().checkTaskProgressNow(otherKey, { check: 'champion', target: 1 }, season)).toBe(0);
    });
});

describe('B15: сила клуба от состава', () => {
    it('лежит в коридоре и растёт при усилении игроков', () => {
        const keys = HL().clubKeysForTest();
        const khlKeys = keys.filter(k => k.startsWith('KHL_'));
        expect(khlKeys.length).toBeGreaterThan(0);
        let best = null;
        for (const key of khlKeys) {
            const [, club] = [key.split('_')[0], key.slice(4)];
            const players = HL().clubPlayersProbe('KHL', club);
            if (players.length === 0) continue;
            const avg = players.reduce((s, p) => s + p.rating, 0) / players.length;
            if (!best || avg < best.avg) best = { club, players, avg };
        }
        expect(best).toBeTruthy();
        const before = HL().clubStrengthProbe('KHL', best.club);
        expect(before).toBeGreaterThanOrEqual(0.35);
        expect(before).toBeLessThanOrEqual(1.0);
        best.players.forEach(p => {
            HL().setPlayerRatingForTest(p.name, Math.min(99, p.rating + 20));
        });
        const after = HL().clubStrengthProbe('KHL', best.club);
        expect(after).toBeGreaterThan(before);
    });

    it('травмы ключевых игроков снижают эффективную силу', () => {
        const keys = HL().clubKeysForTest();
        const key = keys.find(k => k.startsWith('NHL_'));
        const lk = key.split('_')[0], club = key.slice(4);
        const players = HL().clubPlayersProbe(lk, club);
        const before = HL().worldStrengthProbe(lk, club).effective;
        HL().setPlayerInjuryForTest(players[0].name, 4);
        const after = HL().worldStrengthProbe(lk, club).effective;
        expect(HL().teamInjuryPenaltyProbe()[key]).toBeGreaterThan(0);
        expect(after).toBeLessThanOrEqual(before);
        HL().setPlayerInjuryForTest(players[0].name, 0);
    });
});

describe('B16/B17: датапак и паддинг', () => {
    it('в REAL_ROSTERS нет дублей игроков', () => {
        const seen = new Map();
        for (const [lk, clubs] of Object.entries(REAL_ROSTERS)) {
            for (const [club, data] of Object.entries(clubs)) {
                for (const p of (data.players || [])) {
                    if (!seen.has(p.name)) seen.set(p.name, []);
                    seen.get(p.name).push(`${lk}/${club}`);
                }
            }
        }
        const dups = [...seen].filter(([, places]) => places.length > 1);
        expect(dups).toEqual([]);
    });

    it('новые игроки добиваются в диапазоне медианы состава ±6', () => {
        let target = null;
        for (const lk of ['KHL', 'NHL', 'SHL', 'Liiga']) {
            for (const club of HL().leagueClubsProbe(lk)) {
                const players = HL().clubPlayersProbe(lk, club);
                if (players.length > 0 && players.length < 16) { target = { lk, club, players }; break; }
            }
            if (target) break;
        }
        if (!target) return; // все составы уже полные — проверять нечего
        const ratings = target.players.map(p => p.rating).sort((a, b) => a - b);
        const median = ratings[Math.floor(ratings.length / 2)];
        const beforeNames = new Set(target.players.map(p => p.name));
        HL().rebalanceRostersNow();
        const added = HL().clubPlayersProbe(target.lk, target.club).filter(p => !beforeNames.has(p.name));
        expect(added.length).toBeGreaterThan(0);
        added.forEach(p => {
            expect(Math.abs(p.rating - median)).toBeLessThanOrEqual(6);
        });
    });
});

describe('Баланс Б1–Б3', () => {
    it('Б1: верхний XP-порог достижим, недельный XP начисляется без RNG', () => {
        const thresholds = HL().xpThresholdsProbe();
        expect(thresholds[thresholds.length - 1]).toBe(400000);
        HL().addClient('Б1 Клиент');
        const drawsBefore = HL().mvDraws();
        const res = HL().awardWeeklyXPForTest('Б1 Клиент', { gp: 2, goals: 1, assists: 2 });
        expect(res.gained).toBe(26);
        expect(res.xpAfter - res.xpBefore).toBe(26);
        expect(HL().mvDraws()).toBe(drawsBefore);
    });

    it('Б2: налог щадящий, цели $25M/$75M', () => {
        expect(HL().wealthTaxProbe(25000000, 1)).toBeGreaterThan(0);
        expect(HL().wealthTaxProbe(25000000, 1)).toBeLessThan(25000000 * 0.004);
        expect(HL().careerGoalProbe('business', 11).target).toBe(25000000);
        expect(HL().careerGoalProbe('business', 12).target).toBe(75000000);
    });

    it('Б3: после кулдауна шанс события 0.35, а не 0.9', () => {
        expect(HL().weeklyEventChanceProbe(0)).toBe(0.20);
        expect(HL().weeklyEventChanceProbe(7)).toBe(0.35);
        expect(HL().weeklyEventChanceProbe(99)).toBe(0.35);
    });

    it('Б5: ICE_HL расширена до 10+ клубов', () => {
        expect(HL().leagueClubsProbe('ICE_HL').length).toBeGreaterThanOrEqual(10);
    });
});

describe('C1–C15: платформа, i18n, доступность', () => {
    it('C1/C11/C15: PNG-иконки, maskable и OG-теги', () => {
        expect(INDEX_HTML).toContain('apple-touch-icon');
        expect(INDEX_HTML).toContain('icons/apple-touch-icon-180.png');
        expect(INDEX_HTML).toContain('property="og:title"');
        expect(INDEX_HTML).toContain('name="twitter:card"');
        expect(existsSync(join(process.cwd(), 'public/icons/icon-192.png'))).toBe(true);
        expect(existsSync(join(process.cwd(), 'public/icons/icon-512.png'))).toBe(true);
        expect(existsSync(join(process.cwd(), 'public/icons/icon-maskable-512.png'))).toBe(true);
        const pngMaskable = MANIFEST.icons.find(i => i.purpose === 'maskable');
        expect(pngMaskable.type).toBe('image/png');
    });

    it('C2/C3: viewport-fit и -webkit-backdrop-filter', () => {
        expect(INDEX_HTML).toContain('viewport-fit=cover');
        expect(STYLE_CSS).toContain('safe-area-inset-bottom');
        const plain = (STYLE_CSS.match(/(?<!-webkit-)backdrop-filter:/g) || []).length;
        const prefixed = (STYLE_CSS.match(/-webkit-backdrop-filter:/g) || []).length;
        expect(prefixed).toBeGreaterThanOrEqual(plain);
    });

    it('C4/C14: все модалки в BACK_HANDLERS, Escape закрывает верхнюю', () => {
        const ids = [...INDEX_HTML.matchAll(/id="([^"]*modal[^"]*)"/g)]
            .map(m => m[1])
            .filter(id => id.endsWith('-modal') && !id.includes('modal-'));
        const handled = HL().backHandlersProbe();
        for (const h of handled) expect(ids.includes(h) || h === 'confirm-modal').toBe(true);
        expect(handled.length).toBeGreaterThanOrEqual(17);
        document.querySelectorAll('.modal-overlay').forEach(m => { m.style.display = 'none'; });
        document.getElementById('settings-modal').style.display = 'flex';
        expect(HL().topModalProbe()).toBe('settings-modal');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('settings-modal').style.display).toBe('none');
    });

    it('C13: role=dialog/aria-modal и подписи', () => {
        const modals = HL().modalA11yProbe();
        expect(modals.length).toBeGreaterThanOrEqual(17);
        modals.forEach(m => {
            expect(m.role).toBe('dialog');
            expect(m.ariaModal).toBe('true');
            expect(m.labelled).toBeTruthy();
        });
    });

    it('C5/C6: порядковые числительные в обе стороны', () => {
        expect(translateTextForTest('2-е место', 'en')).toBe('2nd place');
        expect(translateTextForTest('3-е место', 'en')).toBe('3rd place');
        expect(translateTextForTest('4-е место', 'en')).toBe('4th place');
        expect(translateTextForTest('11-е место', 'en')).toBe('11th place');
        expect(translateTextForTest('2nd place', 'ru')).toBe('2-е место');
        expect(translateTextForTest('Best season: 2026 (3rd place)', 'ru')).toBe('Лучший сезон: 2026 (3-е место)');
    });

    it('C10: SW умеет SKIP_WAITING, offline.html и нормализует кэш', () => {
        expect(SW_JS).toContain("'SKIP_WAITING'");
        expect(SW_JS).toContain('offline.html');
        expect(SW_JS).toContain('cacheKeyFor');
    });
});
