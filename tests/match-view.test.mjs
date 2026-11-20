// ============================================================
// Просмотр матча: play-by-play сценарий + контроллер воспроизведения.
// Детерминизм: buildMatchScript не двигает глобальный sim-RNG.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const HL = () => window.__HL;
let LANG = null;

// Синтетический результат матча в формате simulateMatchWithDetails.
const RESULT = {
    homeScore: 3, awayScore: 1, isOT: false, isSO: false,
    goals: [
        { minute: 7,  period: 1, team: 'home', scorer: 'Client Goal', assists: ['Helper One'] },
        { minute: 26, period: 2, team: 'home', scorer: 'Second Guy',  assists: [] },
        { minute: 41, period: 3, team: 'away', scorer: 'Enemy Star',  assists: ['Other Assist'] },
        { minute: 55, period: 3, team: 'home', scorer: 'Third Hero',  assists: ['Client Goal'] }
    ],
    threeStars: ['Client Goal', 'Second Guy', 'Third Hero'],
    playerRatings: []
};

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

    // LANG импортируется как live-binding: нужен для проверки переводов.
    ({ LANG } = await import('../i18n.js'));

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Match View Test';
    document.getElementById('ca-agency').value = 'MV Agency';
    document.getElementById('ca-start').click();
    // Клиент с именем автора гола — чтобы проверить подсветку isClient.
    HL().addClient('Client Goal', 'C');
});

afterAll(() => { HL().mvClose(); });

function parse(fn, ...args) { return JSON.parse(fn(...args)); }

describe('buildMatchScript (play-by-play)', () => {
    it('детерминирован: два вызова с одинаковыми входами дают идентичный JSON', () => {
        const a = HL().mvBuildScript('Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        const b = HL().mvBuildScript('Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        expect(b).toBe(a);
    });

    it('не двигает глобальный sim-RNG (детерминизм недели/сезона)', () => {
        const before = HL().mvDraws();
        HL().mvBuildScript('Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        HL().mvBuildScript('Detroit Wings', 'Toronto Maples', 'NHL', 9, RESULT);
        expect(HL().mvDraws()).toBe(before);
    });

    it('события отсортированы по минуте, голы сохранены все', () => {
        const s = parse(HL().mvBuildScript, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        let prevMin = 0;
        for (const e of s.events) {
            expect(e.minute).toBeGreaterThanOrEqual(prevMin);
            prevMin = e.minute;
        }
        const goals = s.events.filter(e => e.type === 'goal');
        expect(goals.length).toBe(4);
        // последний гол имеет финальный счёт
        expect(goals[3].scoreHome).toBe(3);
        expect(goals[3].scoreAway).toBe(1);
    });

    it('типы событий: start, minor-события, границы периодов, end', () => {
        const s = parse(HL().mvBuildScript, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        const types = new Set(s.events.map(e => e.type));
        expect(types.has('start')).toBe(true);
        expect(types.has('shot')).toBe(true);
        expect(types.has('save')).toBe(true);
        expect(types.has('period')).toBe(true);
        expect(s.events[s.events.length - 1].type).toBe('end');
        // ровно три границы периодов
        expect(s.events.filter(e => e.type === 'period').length).toBe(3);
        // minor-событий не менее 30
        const minors = s.events.filter(e => ['shot', 'save', 'hit', 'faceoff', 'penalty'].includes(e.type));
        expect(minors.length).toBeGreaterThanOrEqual(30);
    });

    it('статистика накопительная и монотонная, totals = итоговые значения', () => {
        const s = parse(HL().mvBuildScript, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        const keys = ['shotsH', 'shotsA', 'savesH', 'savesA', 'hitsH', 'hitsA', 'faceoffsH', 'faceoffsA', 'pimH', 'pimA'];
        let prev = keys.map(() => 0);
        for (const e of s.events) {
            keys.forEach((k, i) => {
                expect(e.after[k]).toBeGreaterThanOrEqual(prev[i]);
                prev[i] = e.after[k];
            });
        }
        const last = s.events[s.events.length - 1].after;
        keys.forEach(k => expect(s.totals[k]).toBe(last[k]));
        // голы засчитаны в броски: 3 гола home → shotsH >= 3
        expect(s.totals.shotsH).toBeGreaterThanOrEqual(3);
        expect(s.totals.shotsA).toBeGreaterThanOrEqual(1);
    });

    it('isClient: только события с участием клиента агента', () => {
        const s = parse(HL().mvBuildScript, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        expect(s.clientName).toBe('Client Goal');
        const flagged = s.events.filter(e => e.isClient);
        expect(flagged.length).toBeGreaterThan(0);
        for (const e of flagged) {
            const hit = e.actor === 'Client Goal' || (e.assists || []).includes('Client Goal');
            expect(hit).toBe(true);
        }
        // гол клиента помечен
        const clientGoal = s.events.find(e => e.type === 'goal' && e.actor === 'Client Goal');
        expect(clientGoal.isClient).toBe(true);
        // ассист клиента тоже подсвечен
        const lastGoal = s.events.filter(e => e.type === 'goal').pop();
        expect(lastGoal.isClient).toBe(true); // ассист "Client Goal"
    });

    it('гол home/away: счёт нарастает корректно по событиям', () => {
        const s = parse(HL().mvBuildScript, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        let h = 0, a = 0;
        for (const e of s.events) {
            if (e.type === 'goal') { if (e.team === 'home') h++; else a++; }
            expect(e.scoreHome).toBe(h);
            expect(e.scoreAway).toBe(a);
        }
        expect(h).toBe(3);
        expect(a).toBe(1);
    });
});

describe('контроллер воспроизведения (play/pause/speed/skip/stepBack)', () => {
    it('open → idx=0, total = число событий; stepOnce монотонен', () => {
        const opened = parse(HL().mvOpen, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        expect(opened.idx).toBe(0);
        expect(opened.total).toBeGreaterThan(35);
        const before = parse(HL().mvState);
        expect(HL().mvStepOnce()).toBe(true);
        expect(parse(HL().mvState).idx).toBe(before.idx + 1);
        HL().mvClose();
    });

    it('toggleSpeed переключает 1 ↔ 2', () => {
        HL().mvOpen('Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        expect(parse(HL().mvState).speed).toBe(1);
        expect(HL().mvToggleSpeed()).toBe(2);
        expect(HL().mvToggleSpeed()).toBe(1);
        HL().mvClose();
    });

    it('skip → финал; stepBack от финала уменьшает idx', () => {
        const opened = parse(HL().mvOpen, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        const idx = HL().mvSkip();
        expect(idx).toBe(opened.total);
        expect(parse(HL().mvState).finished).toBe(true);
        expect(HL().mvStepBack()).toBe(opened.total - 1);
        expect(parse(HL().mvState).finished).toBe(false);
        HL().mvClose();
    });

    it('stepOnce на финале возвращает false', () => {
        HL().mvOpen('Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        HL().mvSkip();
        expect(HL().mvStepOnce()).toBe(false);
        HL().mvClose();
    });

    it('тексты событий локализованы и не содержат «undefined»', () => {
        const texts = parse(HL().mvText, 'Boston Bears', 'Buffalo Blades', 'NHL', 3, RESULT);
        expect(texts.length).toBeGreaterThan(35);
        for (const t of texts) {
            expect(typeof t).toBe('string');
            expect(t).not.toContain('undefined');
            expect(t.length).toBeGreaterThan(0);
        }
        // Ключи переводятся через LANG.t: в ru — «ГОЛ!», в en — «GOAL!», «Матч начался!»/«Match started!».
        const lang = LANG.current;
        const goalText = lang === 'ru' ? 'ГОЛ!' : 'GOAL!';
        const startText = lang === 'ru' ? 'Матч начался!' : 'Match started!';
        const endText = lang === 'ru' ? 'Матч завершён!' : 'Match finished!';
        expect(texts.some(t => t.includes(goalText))).toBe(true);
        expect(texts.some(t => t.includes(startText))).toBe(true);
        expect(texts.some(t => t.includes(endText))).toBe(true);
    });
});
