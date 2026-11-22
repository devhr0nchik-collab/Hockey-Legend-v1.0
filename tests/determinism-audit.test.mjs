// ============================================================
// Статический аудит недетерминизма в игровом коде.
// Ловит возврат Math.random/Date.now/toLocaleString в script.js
// и Math.random в любых runtime-модулях симуляции.
// ============================================================
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = readFileSync(join(process.cwd(), 'script.js'), 'utf8');

function listRuntimeFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...listRuntimeFiles(p));
        else if (/\.(js|ts)$/.test(name)) out.push(p);
    }
    return out;
}

const RUNTIME_FILES = [
    join(process.cwd(), 'script.js'),
    join(process.cwd(), 'datapack.js'),
    join(process.cwd(), 'datapack_rosters.js'),
    ...listRuntimeFiles(join(process.cwd(), 'src'))
];

function stripComments(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

describe('аудит недетерминизма', () => {
    it('в script.js нет Math.random()', () => {
        expect(SCRIPT.match(/Math\.random\s*\(/g) || []).toEqual([]);
    });

    it('Math.random отсутствует во всех runtime-модулях симуляции', () => {
        for (const file of RUNTIME_FILES) {
            const code = stripComments(readFileSync(file, 'utf8'));
            expect(code.match(/Math\.random\s*\(/g) || [], file).toEqual([]);
        }
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
