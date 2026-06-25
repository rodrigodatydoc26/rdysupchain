const CACHE = 'rdy-bal-v39';
const SUPABASE = 'https://iedkbtceqgrawgubxslh.supabase.co';

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './icon.svg'
];

// INSTALL: pré-carrega os arquivos principais e ativa imediatamente
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
});

// ACTIVATE: apaga TODOS os caches antigos e assume controle de todos os clientes
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => {
      // Notifica todos os clientes para recarregar a página
      return self.clients.claim().then(() => {
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'SW_UPDATED' });
          });
        });
      });
    })
  );
});

// Mensagem do cliente para forçar atualização manual
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

  // Outros assets: rede primeiro (network-first), cache como fallback
  if (url.origin === self.location.origin || url.hostname.includes('fonts.googleapis') || url.hostname.includes('unpkg.com') || url.hostname.includes('cdn.sheetjs') || url.hostname.includes('jsdelivr.net')) {
    e.respondWith(
      fetch(req.clone())
        .then(res => {
          if (res.status === 200) {
            const resToCache = res.clone();
            caches.open(CACHE).then(c => c.put(req, resToCache));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(cached =>
            cached || new Response('', { status: 503 })
          )
        )
    );
  }
});