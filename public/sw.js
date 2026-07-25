/* Nakliye Defteri — sadece statik kabuk; sayfa/API cache'lenmez */
const CACHE = "nd-v3";
const SHELL = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Sayfa gezintisi / API / fiş — direkt ağ (cache donması olmasın)
  if (req.mode === "navigate") return;
  const url = new URL(req.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/_next/")
  ) {
    return;
  }

  // Sadece ikon / manifest gibi küçük statikler
  if (url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const kopya = res.clone();
            caches.open(CACHE).then((c) => c.put(req, kopya)).catch(() => {});
            return res;
          })
      )
    );
  }
});

/* Yeni yük bildirimi */
self.addEventListener("push", (event) => {
  let veri = { baslik: "Nakliye Defteri", metin: "Yeni bildirim", url: "/" };
  try {
    if (event.data) veri = { ...veri, ...event.data.json() };
  } catch {
    if (event.data) veri.metin = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(veri.baslik, {
      body: veri.metin,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: veri.url,
      data: { url: veri.url },
      vibrate: [80, 40, 80],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hedef = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((pencereler) => {
        for (const pencere of pencereler) {
          if ("focus" in pencere) {
            pencere.navigate?.(hedef);
            return pencere.focus();
          }
        }
        return self.clients.openWindow(hedef);
      })
  );
});
