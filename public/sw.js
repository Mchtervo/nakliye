/* Nakliye Defteri — sadece statik kabuk; sayfa/API cache'lenmez */
const CACHE = "nd-v4";
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

function mutlakUrl(hedef) {
  if (!hedef) return self.location.origin + "/ai/yukler";
  try {
    return new URL(hedef, self.location.origin).href;
  } catch {
    return self.location.origin + "/ai/yukler";
  }
}

/* Yeni yük bildirimi */
self.addEventListener("push", (event) => {
  let veri = {
    baslik: "Yük Avcısı",
    metin: "Yeni bildirim",
    url: "/ai/yukler",
  };
  try {
    if (event.data) veri = { ...veri, ...event.data.json() };
  } catch {
    if (event.data) veri.metin = event.data.text();
  }

  const hedef = mutlakUrl(veri.url);

  event.waitUntil(
    self.registration.showNotification(veri.baslik, {
      body: veri.metin,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: hedef,
      renotify: true,
      data: { url: hedef },
      vibrate: [80, 40, 80],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hedef = mutlakUrl(event.notification.data?.url || "/ai/yukler");

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (pencereler) => {
        for (const pencere of pencereler) {
          if ("focus" in pencere) {
            try {
              if ("navigate" in pencere && typeof pencere.navigate === "function") {
                await pencere.navigate(hedef);
              }
            } catch {
              /* navigate desteklenmeyebilir */
            }
            return pencere.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(hedef);
        }
      })
  );
});
