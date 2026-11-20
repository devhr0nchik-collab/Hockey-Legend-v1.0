// ============================================================
// Свободные агенты: размер пула от уровня, уникальность,
// разброс скиллов и структурированная карточка таланта.
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

    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Свободные Агенты';
    document.getElementById('ca-agency').value = 'FA Agency';
    document.getElementById('ca-start').click();
    window.__startupFreeAgentCount = window.__HL.freeAgentPoolCount();
    window.__HL.addClient('Карточка Тест');
});

describe('свободные агенты', () => {
    it('N зависит от уровня агента', () => {
        expect(window.__HL.freeAgentCountForLevel(1)).toBe(7);
        expect(window.__HL.freeAgentCountForLevel(5)).toBe(15);
        expect(window.__HL.freeAgentCountForLevel(30)).toBe(60);
    });

    it('окно генерирует N уникальных игроков с разными скиллами', () => {
        window.__HL.setSeed(4242);
        const pool = window.__HL.generateFreeAgentWindow(2);
        expect(pool.length).toBe(9);
        expect(new Set(pool.map(p => p.name)).size).toBe(9);
        expect(new Set(pool.map(p => p.position)).size).toBeGreaterThan(1);
        expect(new Set(pool.map(p => p.archetype)).size).toBeGreaterThan(1);
        expect(new Set(pool.map(p => p.nationality)).size).toBeGreaterThan(1);
        expect(new Set(pool.map(p => `${p.attack}|${p.defense}|${p.potential}`)).size).toBeGreaterThan(1);
    });

    it('тот же seed и уровень → тот же пул', () => {
        window.__HL.setSeed(777);
        const first = window.__HL.generateFreeAgentWindow(2);
        window.__HL.setSeed(777);
        const second = window.__HL.generateFreeAgentWindow(2);
        expect(second).toEqual(first);
    });

    it('карточка таланта структурирована', () => {
        const html = window.__HL.buildTalentCardHTML('Карточка Тест');
        expect(html).toContain('talent-card');
        expect(html).toContain('talent-stats');
        expect(html).toContain('talent-arch');
        expect(html).toContain('talent-stat-head');
        expect(html).toContain('talent-card-foot');
    });

    it('интерес клуба зависит от скиллов и уровня лиги', () => {
        const weak = window.__HL.clubInterestProbe('Карточка Тест', 'MHL');
        const strong = window.__HL.clubInterestProbe('Карточка Тест', 'NHL');
        expect(weak.accepted).toBe(true);
        expect(weak.score).toBeGreaterThan(strong.score);
    });

    it('при старте новой игры пул свободных агентов больше 0', () => {
        expect(window.__startupFreeAgentCount).toBeGreaterThan(0);
    });
});
