const CACHE_NAME = 'tax-tracker-v2';
const ASSETS = [
    './index.html',
    './style.css',
    './app.js'
];

// Install the Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
    self.clients.claim();
});

// Intercept network requests
self.addEventListener('fetch', event => {
    // CRITICAL FIX: Only intercept requests that belong to your GitHub Pages app!
    // This allows external Supabase image links to pass through normally.
    if (!event.request.url.startsWith(self.location.origin)) {
        return; // Ignore external links completely
    }

    // For internal app files, serve from cache first, then network
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request);
        })
    );
});
