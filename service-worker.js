const CACHE = 'oakhill-media-lab-v1';
const ASSETS = [
  '/', '/index.html', '/style.css', '/app.js', '/idb.js',
  '/assets/logo.png', '/manifest.json'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e=>{
  const {request} = e;
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(r=>{
      const copy = r.clone();
      caches.open(CACHE).then(c=>c.put(request, copy)).catch(()=>{});
      return r;
    }).catch(()=>caches.match('/index.html')))
  );
});