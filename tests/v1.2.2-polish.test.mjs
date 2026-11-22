// ============================================================
// v1.2.2 «NEON RINK»: своё агентство в рейтинге, сырые юниоры
// на старте и свободные агенты без клубных контрактов.
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
    document.getElementById('ca-name').value = 'Патч v122';
    document.getElementById('ca-agency').value = 'Neon Rink Agency';
    document.getElementById('ca-start').click();
});

const HL = () => window.__HL;

describe('v1.2.2: ребаланс старта', () => {
    it('на 1 уровне скаутинга рейтинг свободных агентов 40–48', () => {
        HL().setAgentLevel(1);
        HL().setScoutingLevelForTest(1);
        const range = HL().scoutingRangeProbe();
        expect(range.max).toBeGreaterThanOrEqual(40);
        expect(range.max).toBeLessThanOrEqual(48);

        HL().setSeed(202622);
        for (let i = 0; i < 3; i++) {
            const pool = HL().generateFreeAgentWindow(1);
            expect(pool.length).toBeGreaterThan(0);
            for (const p of pool) {
                expect(p.rating).toBeLessThanOrEqual(48);
                expect(p.rating).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('стартовые свободные агенты — FA без клуба и без контракта', () => {
        HL().setAgentLevel(1);
        HL().setScoutingLevelForTest(1);
        HL().setSeed(9090);
        const pool = HL().generateFreeAgentWindow(1);
        for (const p of pool) {
            expect(p.club).toBe('');
            expect(p.contractYears).toBe(0);
            expect(p.agentId).toBeNull();
        }
    });
});

describe('v1.2.2: своё агентство в рейтинге', () => {
    it('строка игрока встроена в общий рейтинг и подсвечена', () => {
        const html = HL().renderAgencyRatingForTest();
        expect(html).toContain('agency-row-mine');
        expect(html).toContain('data-agency-mine="1"');
        expect(html).toContain('Neon Rink Agency');
    });
});
