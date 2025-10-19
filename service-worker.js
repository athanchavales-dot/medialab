const CACHE='oakhill-media-lab-v13';
const ASSETS=['./','./index.html','./style.css','./app.js?v=13','./idb.js?v=13','./assets/logo.png','./manifest.json'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(async c=>{ try{ await c.addAll(ASSETS); }catch(e){} }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request).catch(()=>caches.match('./index.html')) ));
});