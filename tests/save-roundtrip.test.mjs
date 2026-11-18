// ============================================================
// Интеграционный тест сейва: новая игра → запись в IndexedDB →
// правка сохранения → resetGame → loadGame. Фиксирует формат
// сохранения (v23) и то, что загрузка реально применяет данные.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const SAVE_KEY = 'hockeyLegendSave_v23';
const DB_NAME = 'hockeyLegendDB';

function openSaveDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('saves')) req.result.createObjectStore('saves');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function readSave() {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        const get = db.transaction('saves', 'readonly').objectStore('saves').get(SAVE_KEY);
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
    });
}

async function writeSave(data) {
    const db = await openSaveDb();
    return new Promise((resolve, reject) => {
        const put = db.transaction('saves', 'readwrite').objectStore('saves').put(data, SAVE_KEY);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
    });
}

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
});

describe('сейв: запись и восстановление', () => {
    it('новую игру можно сохранить и прочитать из IndexedDB', async () => {
        document.getElementById('btn-new-game').click();
        document.getElementById('ca-name').value = 'Сейв Тестов';
        document.getElementById('ca-agency').value = 'Save Agency';
        document.getElementById('ca-start').click();

        await window.__HL.saveGame();
        await new Promise((r) => setTimeout(r, 100)); // saveGame не возвращает промис idbSet

        const data = await readSave();
        expect(data).toBeTruthy();
        expect(data.v).toBe(23);
        expect(data.agentName).toBe('Сейв Тестов');
        expect(data.money).toBe(3000);
        expect(Array.isArray(data.players)).toBe(true);
        expect(data.players.length).toBeGreaterThan(1000);
        expect(data.players[0].length).toBe(33); // формат PackedPlayer
    });

    it('loadGame применяет данные из сейва поверх сброшенного состояния', async () => {
        const saved = await readSave();
        const expectedPlayers = saved.players.length;

        // Правим сохранение «извне» — так видно, что loadGame реально его читает.
        saved.agentName = 'Загруженный Агент';
        saved.money = 777000;
        saved.s = 2030;
        saved.w = 7;
        await writeSave(saved);

        window.__HL.resetGame();
        expect(window.__HL.getState().currentSeason).toBe(2026);
        expect(window.__HL.getState().agentMoney).toBe(3000);

        const ok = await window.__HL.loadGame();
        expect(ok).toBe(true);

        const after = window.__HL.getState();
        expect(after.agentName).toBe('Загруженный Агент');
        expect(after.agentMoney).toBe(777000);
        expect(after.currentSeason).toBe(2030);
        expect(after.currentWeek).toBe(7);
        expect(after.playersCount).toBe(expectedPlayers);
    });
});
