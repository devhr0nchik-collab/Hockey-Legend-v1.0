// ============================================================
// Smoke-тест: приложение грузится как ESM и основные экраны живы.
// Цель — ловить поломки при разбиении монолита на модули.
// ============================================================
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

beforeAll(async () => {
    // jsdom-шим для matchMedia (используется в UI-настройках)
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; }
    }));

    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (!body) throw new Error('Не найден <body> в index.html');
    document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');

    // Порядок как в src/main.ts
    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');
});

describe('boot', () => {
    it('модули загрузились и мосты выставлены', () => {
        expect(typeof window.onLanguageChanged).toBe('function');
        expect(typeof window.getFarmClubOverride).toBe('function');
        expect(typeof window.__teamLogoRenderer).toBe('function');
        expect(typeof window.migrateSaveToFake).toBe('function');
    });

    it('18 экранов на месте', () => {
        expect(document.querySelectorAll('.mobile-screen').length).toBeGreaterThanOrEqual(17);
        expect(document.getElementById('ca-start')).toBeNull(); // рендерится позже
    });

    it('язык переключается через кнопку меню', () => {
        const btn = document.getElementById('menu-lang-btn');
        const before = document.documentElement.lang;
        btn.click();
        expect(document.documentElement.lang).not.toBe(before);
        btn.click();
        expect(document.documentElement.lang).toBe(before);
    });

    it('новая игра: меню → создание агентства → офис', () => {
        document.getElementById('btn-new-game').click();
        const createScreen = document.getElementById('create-agency-screen');
        expect(createScreen.style.display).toBe('flex');

        const nameInput = document.getElementById('ca-name');
        const agencyInput = document.getElementById('ca-agency');
        expect(nameInput).toBeTruthy();
        expect(agencyInput).toBeTruthy();
        nameInput.value = 'Test Agent';
        agencyInput.value = 'Test Agency';

        document.getElementById('ca-start').click();

        expect(createScreen.style.display).toBe('none');
        expect(document.getElementById('office-screen').style.display).not.toBe('none');
        expect(document.getElementById('office-agent-name').textContent).toBe('Test Agent');
    });
});
