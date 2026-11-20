// ============================================================
// 2D-аватары NEON RINK: выбор папки по позиции, детерминизм,
// диапазон индекса и класс .player-avatar.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const FACES = join(process.cwd(), 'public', 'faces');

let getPlayerAvatar;

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
    const mod = await import('../script.js');
    await import('../datapack.js');
    getPlayerAvatar = mod.getPlayerAvatar;
});

describe('getPlayerAvatar', () => {
    it('вратарь (G) берёт картинку из faces/goalies', () => {
        const html = getPlayerAvatar({ name: 'Goalie Test', position: 'G' });
        expect(html).toContain('faces/goalies/g');
        expect(html).not.toContain('faces/players/');
    });

    it('полевые (C, LW, RW, D) берут картинки из faces/players', () => {
        for (const pos of ['C', 'LW', 'RW', 'D']) {
            const html = getPlayerAvatar({ name: `Skater ${pos}`, position: pos });
            expect(html).toContain('faces/players/p');
            expect(html).not.toContain('faces/goalies/');
        }
    });

    it('детерминирован: одно имя → один и тот же src', () => {
        const a = getPlayerAvatar({ name: 'Иван Петров', position: 'C' });
        const b = getPlayerAvatar({ name: 'Иван Петров', position: 'C' });
        expect(a).toBe(b);
    });

    it('индекс в диапазоне файлов папки, файл существует', () => {
        for (let i = 0; i < 40; i++) {
            const isG = i % 5 === 0;
            const html = getPlayerAvatar({ name: 'Player ' + i, position: isG ? 'G' : 'C' });
            const m = html.match(/faces\/(players|goalies)\/([pg])(\d+)\.png/);
            expect(m).toBeTruthy();
            const idx = parseInt(m[3], 10);
            expect(idx).toBeGreaterThanOrEqual(1);
            expect(idx).toBeLessThanOrEqual(m[1] === 'players' ? 8 : 1);
            expect(existsSync(join(FACES, m[1], `${m[2]}${idx}.png`))).toBe(true);
        }
    });

    it('рендерит <img class="player-avatar">', () => {
        const html = getPlayerAvatar({ name: 'Class Check', position: 'LW' });
        expect(html).toMatch(/<img class="player-avatar"[^>]*src="faces\/players\/p\d+\.png"/);
    });

    it('терпим к мусору на входе (fallback-SVG)', () => {
        const html = getPlayerAvatar(null);
        expect(html).toContain('player-avatar');
        expect(html).toContain('<svg');
    });

    it('папки портретов на диске соответствуют AVATAR_COUNTS', () => {
        const players = readdirSync(join(FACES, 'players')).filter(f => f.endsWith('.png'));
        const goalies = readdirSync(join(FACES, 'goalies')).filter(f => f.endsWith('.png'));
        expect(players.length).toBe(8);
        expect(goalies.length).toBeGreaterThanOrEqual(1);
    });
});
