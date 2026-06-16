const CACHE = 'rdy-bal-v13';
const SUPABASE = 'https://jvwrbrypyrwnaaqijbqm.supabase.co';

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
});

self.addEventListener('activate', e => {
  self.clients.claim();
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE ? caches.delete(k) : null)
    ))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Supabase API: rede primeiro, cache como fallback
  if (url.origin === SUPABASE) {
    e.respondWith(
      fetch(req.clone())
        .then(res => {
          if (res.status === 200) {
            const resToCache = res.clone();
            caches.open(CACHE).then(c => c.put(req, resToCache));
            // Notificar clientes sobre sync bem-sucedido
            self.clients.matchAll().then(clients => {
              clients.forEach(client => client.postMessage({ type: 'SYNC_OK', time: Date.now() }));
            });
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(cached =>
            cached || new Response('[]', {
              headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' }
            })
          )
        )
    );
    return;
  }

  // Outros assets: cache primeiro, atualiza em background
  if (url.origin === self.location.origin || url.hostname.includes('fonts.googleapis') || url.hostname.includes('unpkg.com') || url.hostname.includes('cdn.sheetjs')) {
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req.clone()).then(res => {
          if (res.status === 200) {
            const resToCache = res.clone();
            caches.open(CACHE).then(c => c.put(req, resToCache));
          }
          return res;
        }).catch(() => cached || new Response('', { status: 503 }));
        return cached || network;
      })
    );
  }
});