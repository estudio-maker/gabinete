/* Casa · service worker: guarda la app para que abra sin internet (siempre intenta primero la versión nueva). */
const C="casa-v1";
const SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
self.addEventListener("install",e=>{ self.skipWaiting(); e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{})); });
self.addEventListener("activate",e=>e.waitUntil((async()=>{ for(const k of await caches.keys()) if(k!==C) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin) return;
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(C).then(c=>c.put(e.request,cp)); } return r; })
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("index.html"))));
});
