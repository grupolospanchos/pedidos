// Service worker del PANEL (alcance /pedidos/panel/). Solo guarda la página del panel por si no hay señal.
const C = 'glp-panel-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('glp-panel') && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok){ const copia = r.clone(); caches.open(C).then(c => c.put('./', copia)); } return r; }).catch(() => caches.match('./')));
});
