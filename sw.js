/* Gabinete · service worker: solo muestra notificaciones push (no guarda nada en caché). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const base = self.registration.scope;
  e.waitUntil(self.registration.showNotification(d.title || "Gabinete", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag,
    icon: base + "icon-192.png", badge: base + "icon-192.png", data: { url: d.url || base }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if (c.url.startsWith(self.registration.scope)) { await c.focus(); try { await c.navigate(url); } catch (_) { c.postMessage({ open: url }); } return; } }
    await self.clients.openWindow(url);
  })());
});
