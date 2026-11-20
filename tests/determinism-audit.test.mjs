// ============================================================
// Статический аудит недетерминизма в игровом коде.
// Ловит возврат Math.random/Date.now/toLocaleString в script.js.
// ============================================================
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = readFileSync(join(process.cwd(), 'script.js'), 'utf8');

describe('аудит недетерминизма', () => {
    it('в script.js нет Math.random()', () => {
        expect(SCRIPT.match(/Math\.random\s*\(/g) || []).toEqual([]);
    });

    it('в script.js нет performance.now()', () => {
        expect(SCRIPT.match(/performance\.now\s*\(/g) || []).toEqual([]);
    });

    it('в script.js нет locale-зависимого toLocaleString()', () => {
        expect(SCRIPT.match(/\.toLocaleString\s*\(/g) || []).toEqual([]);
    });

    it('Date.now() остаётся только метаданным сейва', () => {
        const hits = SCRIPT.match(/Date\.now\s*\(/g) || [];
        expect(hits.length).toBe(1);
        expect(SCRIPT).toMatch(/\bt:\s*Date\.now\(\),\s*\/\/\s*метаданные сейва/);
    });
});
