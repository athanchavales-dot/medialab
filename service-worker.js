const CACHE='oakhill-media-lab-v5';
const ASSETS=['./','./index.html','./style.css','./app.js','./idb.js','./assets/logo.png','./manifest.json'];
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(async c=>{
      try{ await c.addAll(ASSETS); }catch(e){ /* ignore offline addAll errors on Pages subpaths */ }
    }).then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate',e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).catch(()=>caches.match('./index.html')) ));
});