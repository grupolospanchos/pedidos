const C = 'glp-v2';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./'])).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;          // solo páginas; nada de Firebase ni fotos
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  const clave = u.pathname.endsWith('admin.html') ? 'admin.html' : './';
  e.respondWith(fetch(e.request).then(r => { if (r.ok){ const copia = r.clone(); caches.open(C).then(c => c.put(clave, copia)); } return r; }).catch(() => caches.match(clave)));
});
