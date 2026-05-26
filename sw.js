// A basic service worker to satisfy PWA install requirements
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installed');
});

self.addEventListener('fetch', (e) => {
    // For now, just fetch from the network normally
    e.respondWith(fetch(e.request));
});
