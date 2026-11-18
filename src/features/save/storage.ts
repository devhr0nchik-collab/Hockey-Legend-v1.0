// ============================================================
// IndexedDB-хранилище сейвов.
// Единственное место, которое знает про indexedDB; остальной код
// работает через маленький интерфейс get/set/delete.
// ============================================================

export interface IdbStore {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
}

const dbCache = new Map<string, Promise<IDBDatabase>>();

function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
    const cached = dbCache.get(dbName);
    if (cached) return cached;

    const promise = new Promise<IDBDatabase>((resolve, reject) => {
        try {
            const req = indexedDB.open(dbName, 1);
            req.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });

    dbCache.set(dbName, promise);
    return promise;
}

export function createIdbStore(dbName: string, storeName: string): IdbStore {
    const withStore = <T>(
        mode: IDBTransactionMode,
        run: (store: IDBObjectStore) => IDBRequest
    ): Promise<T> =>
        openDB(dbName, storeName).then(
            (db) =>
                new Promise<T>((resolve, reject) => {
                    const tx = db.transaction(storeName, mode);
                    const req = run(tx.objectStore(storeName));
                    req.onsuccess = () => resolve(req.result as T);
                    req.onerror = () => reject(req.error);
                })
        );

    return {
        get: <T = unknown>(key: string) => withStore<T | undefined>('readonly', (s) => s.get(key)),
        set: (key: string, value: unknown) =>
            withStore<unknown>('readwrite', (s) => s.put(value, key)).then(() => undefined),
        delete: (key: string) =>
            withStore<unknown>('readwrite', (s) => s.delete(key)).then(() => undefined)
    };
}
