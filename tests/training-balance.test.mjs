// ============================================================
// Этап 2.1: тренировки — динамическая цена и авторежим.
// Цена растёт с рейтингом/уровнем агента, автотренировка стартует
// и останавливается, деньги не уходят в минус, старые сейвы читаются.
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

    localStorage.setItem('hockeyLegendLang', 'ru');
    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Тренировки Тест';
    document.getElementById('ca-agency').value = 'Training Agency';
    document.getElementById('ca-start').click();
    window.__HL.addClient('Тренируемый Клиент');
    // v1.2: на старте уже 2 клиента — фиксируем карьерные цели, чтобы их
    // денежные награды не искажали проверки стоимости тренировок.
    window.__HL.completeCareerGoalsForTest();
});

describe('2.1 Тренировки: динамическая цена', () => {
    it('цена зависит от рейтинга и уровня агента, а не равна 50k', () => {
        expect(window.__HL.trainingCostProbe(50, 1)).toBe(3500); // 1500 + 50*40
        expect(window.__HL.trainingCostProbe(80, 10)).toBe(7238); // 4700 * 1.54
        expect(window.__HL.trainingCostProbe(80, 10)).not.toBe(50000);

        const c1 = window.__HL.trainingCostProbe(60, 1);
        const c2 = window.__HL.trainingCostProbe(80, 1);
        const c3 = window.__HL.trainingCostProbe(80, 10);
        expect(c2).toBeGreaterThan(c1);
        expect(c3).toBeGreaterThan(c2);
        expect(c1).toBeLessThan(25000);
    });

    it('верхний предел — $25 000', () => {
        expect(window.__HL.trainingCostProbe(99, 100)).toBe(25000);
    });
});

describe('2.1 Тренировки: авторежим', () => {
    it('стартует блок сразу, продлевает его и не уходит в минус', () => {
        const name = 'Тренируемый Клиент';
        window.__HL.setMoneyForTest(20000);
        window.__HL.setSeed(9001);

        const state = window.__HL.toggleAutoTrainingNow(name, 'attack');
        expect(state[name]).toBe('attack');

        let probe = window.__HL.trainingProbe(name);
        expect(probe.trainingWeeks).toBe(2);
        expect(probe.trainingAttr).toBe('attack');
        expect(probe.money).toBe(20000 - probe.cost);
        expect(probe.money).toBeGreaterThanOrEqual(0);

        // Первая неделя: блок ещё идёт, деньги не списываются повторно.
        window.__HL.processTrainingsNow();
        probe = window.__HL.trainingProbe(name);
        expect(probe.trainingWeeks).toBe(1);

        // Вторая неделя: блок завершён и авто сразу запускает следующий.
        const beforeRestart = probe.money;
        window.__HL.processTrainingsNow();
        probe = window.__HL.trainingProbe(name);
        expect(probe.trainingWeeks).toBe(2);
        expect(probe.trainingAttr).toBe('attack');
        expect(probe.money).toBeLessThan(beforeRestart);
        expect(probe.money).toBeGreaterThanOrEqual(0);
    });

    it('останавливается без денег и пишет новость', () => {
        const name = 'Тренируемый Клиент';
        window.__HL.setMoneyForTest(0);

        window.__HL.processTrainingsNow(); // 2 → 1
        window.__HL.processTrainingsNow(); // 1 → 0, авто пытается стартовать

        const probe = window.__HL.trainingProbe(name);
        expect(probe.trainingWeeks).toBe(0);
        expect(probe.trainingAttr).toBeNull();
        expect(probe.money).toBe(0);
        expect(window.__HL.trainingAutoState()[name]).toBeUndefined();

        const news = JSON.parse(window.__HL.weekSnapshot()).news.map(n => n[0]);
        expect(news.some(t => t.includes('Автотренировка остановлена'))).toBe(true);
    });

    it('останавливается, если атрибут достиг 99', () => {
        const name = 'Тренируемый Клиент';
        window.__HL.setMoneyForTest(50000);
        window.__HL.setPlayerAttrForTest(name, 'speed', 99);
        window.__HL.setTrainingAutoForTest(name, 'speed');
        window.__HL.tryAutoTrainingNow(name);

        expect(window.__HL.trainingAutoState()[name]).toBeUndefined();
        expect(window.__HL.trainingProbe(name).trainingWeeks).toBe(0);
        expect(window.__HL.trainingProbe(name).money).toBe(50000);
    });

    it('результат тренировки тратит те же simRandom()-вызовы', () => {
        const name = 'Тренируемый Клиент';
        window.__HL.setMoneyForTest(50000);
        window.__HL.setTrainingAutoForTest(name, 'defense');

        const d0 = window.__HL.mvDraws();
        window.__HL.tryAutoTrainingNow(name); // старт блока — 0 бросков
        expect(window.__HL.mvDraws() - d0).toBe(0);

        window.__HL.processTrainingsNow(); // 2 → 1 — 0 бросков
        expect(window.__HL.mvDraws() - d0).toBe(0);

        window.__HL.processTrainingsNow(); // завершение — 1 бросок + автостарт без RNG
        expect(window.__HL.mvDraws() - d0).toBe(1);
    });
});

describe('2.1 Тренировки: совместимость сейвов', () => {
    it('старый сейв без trainingAuto загружается с пустым объектом', async () => {
        window.__HL.setTrainingAutoForTest('Тренируемый Клиент', 'attack');
        await window.__HL.saveGame();
        await new Promise((r) => setTimeout(r, 100));

        const data = await readSave();
        expect(data.trainingAuto).toBeTruthy();
        delete data.trainingAuto;
        await writeSave(data);

        const ok = await window.__HL.loadGame();
        expect(ok).toBe(true);
        expect(window.__HL.trainingAutoState()).toEqual({});
    });
});
