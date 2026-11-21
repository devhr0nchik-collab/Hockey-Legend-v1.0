// ============================================================
// v1.1 B12: очередь модальных окон.
// Несколько модалок за один тик не перезаписывают друг друга:
// показывается первая, остальные ждут закрытия.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));

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
    document.getElementById('ca-name').value = 'Модалки Тест';
    document.getElementById('ca-agency').value = 'Modal Agency';
    document.getElementById('ca-start').click();
});

describe('v1.1 B12: очередь модалок', () => {
    it('3 модалки подряд: в DOM видна только первая, остальные ждут', async () => {
        window.__HL.resetModalQueueForTest();

        window.__HL.queueInfoModalForTest('Первая модалка', '1');
        window.__HL.queueInfoModalForTest('Вторая модалка', '2');
        const state = window.__HL.queueInfoModalForTest('Третья модалка', '3');

        expect(state.open).toBe(true);
        expect(state.pending).toBe(2);
        expect(state.title).toContain('Первая модалка');
        expect(document.getElementById('event-modal').style.display).toBe('flex');
        expect(document.querySelectorAll('#event-modal').length).toBe(1);

        // Закрываем первую штатной кнопкой — открывается ровно одна следующая.
        document.querySelector('#event-actions button').click();
        await tick();

        const afterFirst = window.__HL.modalQueueState();
        expect(afterFirst.open).toBe(true);
        expect(afterFirst.title).toContain('Вторая модалка');
        expect(afterFirst.pending).toBe(1);

        document.querySelector('#event-actions button').click();
        await tick();

        const afterSecond = window.__HL.modalQueueState();
        expect(afterSecond.open).toBe(true);
        expect(afterSecond.title).toContain('Третья модалка');
        expect(afterSecond.pending).toBe(0);

        document.querySelector('#event-actions button').click();
        await tick();

        const done = window.__HL.modalQueueState();
        expect(done.open).toBe(false);
        expect(done.pending).toBe(0);
        expect(document.getElementById('event-modal').style.display).toBe('none');
    });

    it('модалка с выбором не блокирует очередь и закрывается своей кнопкой', async () => {
        window.__HL.resetModalQueueForTest();
        window.__HL.queueInfoModalForTest('Выбор', 'Нажмите OK');
        const opened = window.__HL.modalQueueState();
        expect(opened.open).toBe(true);

        const buttons = document.querySelectorAll('#event-actions button');
        expect(buttons.length).toBe(1);
        expect(buttons[0].textContent).toBe('OK');
        buttons[0].click();
        await tick();

        expect(window.__HL.modalQueueState().open).toBe(false);
    });
});
