// ============================================================
// v1.1 «Живой мир и звук»:
// — динамические события мира (банкротство/тренер/арена) на отдельном RNG;
// — сохранение состояния мира, кулдауны, защита клуба президента;
// — звуковые пресеты whistle/siren без падений в jsdom.
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
    document.getElementById('ca-name').value = 'Мир Тест';
    document.getElementById('ca-agency').value = 'World Agency';
    document.getElementById('ca-start').click();
});

function pickClubKey({ minSquad = 5, skip = [] } = {}) {
    const keys = window.__HL.clubKeysForTest();
    return keys.find(k => !skip.includes(k) && window.__HL.worldClubSquadSize(k) >= minSquad);
}

describe('v1.1 звук: пресеты Web Audio', () => {
    it('click/whistle/siren присутствуют', () => {
        const presets = window.__HL.soundPresetsProbe();
        expect(presets).toContain('click');
        expect(presets).toContain('whistle');
        expect(presets).toContain('siren');
    });

    it('все presets проигрываются без AudioContext и не бросают исключений', () => {
        for (const kind of window.__HL.soundPresetsProbe()) {
            expect(window.__HL.soundPlayNow(kind)).toBe(true);
        }
        expect(window.__HL.soundPlayNow('unknown-kind')).toBe(true);
    });

    it('при выключенном звуке вызов — no-op без ошибок', () => {
        window.__HL.setSoundForTest(false);
        expect(window.__HL.soundPlayNow('siren')).toBe(true);
        expect(window.__HL.soundPlayNow('whistle')).toBe(true);
        window.__HL.setSoundForTest(true);
    });

    it('звук проходит через GainNode + low-pass фильтр с плавными рампами', () => {
        const calls = { gains: 0, filters: 0, ramps: 0 };
        const param = () => ({
            value: 0,
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() { calls.ramps++; }
        });
        const node = () => ({ connect(target) { return target; } });
        const fakeCtx = {
            state: 'running',
            currentTime: 1,
            destination: node(),
            createOscillator: () => ({
                ...node(), type: 'sine', frequency: param(), start() {}, stop() {}
            }),
            createGain: () => { calls.gains++; return { ...node(), gain: param() }; },
            createBiquadFilter: () => {
                calls.filters++;
                return { ...node(), type: '', frequency: param(), Q: param() };
            }
        };
        window.__HL.setAudioContextForTest(fakeCtx);
        expect(window.__HL.soundPlayNow('siren')).toBe(true);
        expect(calls.gains).toBeGreaterThan(0);
        expect(calls.filters).toBeGreaterThan(0);
        expect(calls.ramps).toBeGreaterThan(0);
        expect(window.__HL.soundMasterProbe()).toBeLessThan(0.8);
        window.__HL.setAudioContextForTest(null);
    });
});

describe('v1.1 живой мир: события', () => {
    it('тик мира не тратит основной sim-RNG (детерминизм матчей цел)', () => {
        window.__HL.setWorldClockForTest(2026, 10);
        const res = window.__HL.worldTickNow('coach', pickClubKey());
        expect(res).toBeTruthy();
        expect(res.draws).toBe(0);
    });

    it('тренер даёт временный эффект и истекает', () => {
        const key = pickClubKey();
        window.__HL.setWorldClockForTest(2026, 12);
        const before = window.__HL.worldStrengthProbe(...splitKey(key));
        const res = window.__HL.worldTickNow('coach', key);
        expect(res.event.type).toBe('coach');
        expect(res.event.mult).not.toBe(1);
        const during = window.__HL.worldStrengthProbe(...splitKey(key));
        expect(during.effective).not.toBeCloseTo(before.base, 6);
        expect(res.state.effects[key]).toBeTruthy();

        window.__HL.setWorldClockForTest(2026, 30);
        const after = window.__HL.worldStrengthProbe(...splitKey(key));
        expect(after.effective).toBeCloseTo(before.base, 6);
    });

    it('арена повышает бюджет и уровень стадиона', () => {
        const key = pickClubKey();
        window.__HL.setWorldClockForTest(2026, 14);
        const before = window.__HL.worldClubProbe(key);
        const res = window.__HL.worldTickNow('arena', key);
        expect(res.event.type).toBe('arena');
        expect(res.event.budget).toBeGreaterThan(0);
        const after = window.__HL.worldClubProbe(key);
        expect(after.budget).toBe(before.budget + res.event.budget);
        expect(after.stadium).toBe(Math.min(25, before.stadium + 1));
    });

    it('банкротство отправляет игроков в свободные агенты и обнуляет долг', () => {
        const key = pickClubKey({ minSquad: 8 });
        window.__HL.setWorldClockForTest(2026, 16);
        window.__HL.setClubBudgetForTest(key, -500000);
        const res = window.__HL.worldTickNow('bankruptcy', key);
        expect(res.event.type).toBe('bankruptcy');
        expect(res.event.players.length).toBeGreaterThanOrEqual(1);
        expect(res.event.players.length).toBeLessThanOrEqual(2);
        for (const name of res.event.players) {
            const p = window.__HL.playerClubProbe(name);
            expect(p.club).toBe('');
            expect(p.isScouted).toBe(true);
        }
        const club = window.__HL.worldClubProbe(key);
        expect(club.budget).toBeGreaterThanOrEqual(0);
        expect(res.state.debtWeeks[key]).toBe(0);
        expect(res.state.feed[0].text).toContain(club.club);
        expect(res.state.cooldowns[key]).toBeGreaterThan(2026 * 100 + 16);
    });

    it('клуб президента защищён от банкротства', () => {
        const key = pickClubKey({ minSquad: 8 });
        window.__HL.setPresidentForTest(key, 60);
        window.__HL.setWorldClockForTest(2026, 18);
        const feedBefore = window.__HL.worldStateProbe().feed.length;
        const res = window.__HL.worldTickNow('bankruptcy', key);
        expect(res.event).toBeNull();
        expect(window.__HL.worldStateProbe().feed.length).toBe(feedBefore);
    });

    it('после события клуб уходит на кулдаун и не попадает в кандидаты', () => {
        const key = pickClubKey();
        window.__HL.setWorldClockForTest(2026, 26);
        window.__HL.worldTickNow('arena', key);
        expect(window.__HL.worldCandidatesNow()).not.toContain(key);

        window.__HL.setWorldClockForTest(2026, 40);
        expect(window.__HL.worldCandidatesNow()).toContain(key);
    });

    it('событие попадает в новости с категорией world', () => {
        const key = pickClubKey();
        window.__HL.setWorldClockForTest(2026, 20);
        window.__HL.worldTickNow('arena', key);
        const news = JSON.parse(window.__HL.weekSnapshot()).news.map(n => n[0]);
        expect(news.some(t => t.includes('строительство арены'))).toBe(true);
    });

    it('important world event показывает угловой NEON-баннер', () => {
        document.getElementById('world-toast-wrap')?.remove();
        const key = pickClubKey();
        window.__HL.setWorldClockForTest(2026, 32);
        window.__HL.worldTickNow('coach', key);
        expect(window.__HL.worldToastCount()).toBeGreaterThan(0);
        const club = window.__HL.worldClubProbe(key).club;
        expect(window.__HL.worldToastTexts().some(t => t.includes(club))).toBe(true);
    });
});

describe('v1.1 трансферные слухи', () => {
    it('клуб интересуется клиентом, новость появляется, RNG основной не тратится', () => {
        const clientName = window.__HL.addClient('Слух Клиент');
        window.__HL.setWorldClockForTest(2026, 28);
        const res = window.__HL.rumorNow(true);
        expect(res.event).toBeTruthy();
        expect(res.event.type).toBe('rumor');
        expect(res.event.text).toContain('проявляет интерес');
        expect(res.draws).toBe(0);

        const news = JSON.parse(window.__HL.weekSnapshot()).news.map(n => n[0]);
        expect(news.some(t => t.includes(res.event.player))).toBe(true);

        // Цель — клиент агентства или свободный агент.
        const roster = window.__HL.getState().roster;
        const probe = window.__HL.playerClubProbe(res.event.player);
        expect(roster.includes(res.event.player) || probe.club === '').toBe(true);
        expect(clientName).toBeTruthy();
    });

    it('кулдаун слухов — 1–2 недели', () => {
        window.__HL.setWorldClockForTest(2026, 34);
        const res = window.__HL.rumorNow(true);
        expect(res.event).toBeTruthy();
        const now = 2026 * 100 + 34;
        const wait = window.__HL.rumorUntilProbe() - now;
        expect(wait).toBeGreaterThanOrEqual(1);
        expect(wait).toBeLessThanOrEqual(2);
        expect(window.__HL.rumorNow(false).event).toBeNull();
    });
});

describe('v1.1 живой мир: сейв и детерминизм', () => {
    it('старый сейв без worldState загружается с пустым состоянием', async () => {
        window.__HL.saveGame();
        const data = JSON.parse(JSON.stringify(window._lastSaveData));
        delete data.worldState;
        expect(await window.__HL.importSaveData(data)).toBe(true);
        const st = window.__HL.worldStateProbe();
        expect(st).toEqual({ v: 1, cooldowns: {}, debtWeeks: {}, effects: {}, feed: [], rumorUntil: 0 });
    });

    it('одинаковый сейв + одинаковый час дают одинаковое событие', async () => {
        window.__HL.saveGame();
        const base = JSON.parse(JSON.stringify(window._lastSaveData));
        base.worldState = { v: 1, cooldowns: {}, debtWeeks: {}, effects: {}, feed: [], rumorUntil: 0 };

        const run = async () => {
            expect(await window.__HL.importSaveData(JSON.parse(JSON.stringify(base)))).toBe(true);
            window.__HL.setWorldClockForTest(2026, 22);
            const res = window.__HL.worldTickNow('coach', pickClubKey());
            return JSON.stringify({ event: res.event, state: res.state });
        };

        expect(await run()).toBe(await run());
    });

    it('worldState переживает save → load', async () => {
        window.__HL.setWorldClockForTest(2026, 24);
        const key = pickClubKey();
        window.__HL.worldTickNow('arena', key);
        const expected = window.__HL.worldStateProbe();

        window.__HL.saveGame();
        const data = JSON.parse(JSON.stringify(window._lastSaveData));
        expect(await window.__HL.importSaveData(data)).toBe(true);

        expect(window.__HL.worldStateProbe()).toEqual(expected);
    });
});

function splitKey(key) {
    // clubKey = "<league>_<club>"; лига может содержать подчёркивания.
    const keys = window.__HL.clubKeysForTest();
    const found = keys.includes(key) ? key : keys.find(k => k === key);
    const probe = window.__HL.worldClubProbe(found || key);
    return [probe.league, probe.club];
}
