// ============================================================
// Тесты IndexedDB-хранилища сейвов (fake-indexeddb).
// ============================================================
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createIdbStore } from '../src/features/save/storage';

const SAVE = {
    v: 23,
    s: 2026,
    w: 10,
    players: [
        ['Игрок', 'Клуб', 'NHL', 'C', 20, 60, 70, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, [], 0, 1, false, [], [], 'calm', null, 0, '', 0, null, false, 0, null, '']
    ]
};

describe('createIdbStore', () => {
    it('сохраняет и читает объект как есть', async () => {
        const store = createIdbStore('test-db-1', 'saves');
        await store.set('hockeyLegendSave_v23', SAVE);
        const loaded = await store.get('hockeyLegendSave_v23');
        expect(loaded).toEqual(SAVE);
    });

    it('возвращает undefined для отсутствующего ключа', async () => {
        const store = createIdbStore('test-db-1', 'saves');
        expect(await store.get('nope')).toBeUndefined();
    });

    it('удаляет ключ', async () => {
        const store = createIdbStore('test-db-1', 'saves');
        await store.set('tmp', { a: 1 });
        await store.delete('tmp');
        expect(await store.get('tmp')).toBeUndefined();
    });

    it('переживает пересоздание стора (кэш БД на имя)', async () => {
        const first = createIdbStore('test-db-2', 'saves');
        await first.set('k', 42);
        const second = createIdbStore('test-db-2', 'saves');
        expect(await second.get('k')).toBe(42);
    });

    it('сейв с 33 полями игрока сериализуется без потерь', async () => {
        const store = createIdbStore('test-db-3', 'saves');
        await store.set('save', SAVE);
        const loaded = await store.get('save');
        expect(loaded.players[0].length).toBe(33);
        expect(loaded.players[0][0]).toBe('Игрок');
    });
});
