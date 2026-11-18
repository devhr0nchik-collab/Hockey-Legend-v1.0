// ============================================================
// HOCKEY LEGEND — Service Worker (оффлайн-оболочка)
// ============================================================
// Стратегия: network-first с фоллбэком в кэш. Так игрок всегда
// получает свежую версию файлов, но может играть без сети.
// Сейвы живут в IndexedDB и Service Worker их не трогает.
// ============================================================

const CACHE_NAME = 'hockey-legend-v1.1.0';

// После перехода на Vite JS/CSS собираются в файлы с хешем в имени,
// поэтому список «оболочки» минимальный: остальное кэшируется на лету
// в обработчике fetch (network-first с фоллбэком в кэш).
const APP_SHELL = [
    './',
    './index.html',
    './icon.svg',
    './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // внешние логотипы не кэшируем

    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() =>
                caches.match(req).then((cached) => {
                    if (cached) return cached;
                    if (req.mode === 'navigate') return caches.match('./index.html');
                    return Response.error();
                })
            )
    );
});
