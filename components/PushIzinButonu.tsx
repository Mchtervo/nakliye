"use client";

import { useEffect, useState } from "react";

type Hal =
  | "kontrol"
  | "desteklenmiyor"
  | "kapali"
  | "acik"
  | "reddedildi"
  | "hata";

/** VAPID açık anahtarını PushManager'ın beklediği biçime çevirir. */
function vapidAnahtar(base64: string): Uint8Array {
  const dolgu = "=".repeat((4 - (base64.length % 4)) % 4);
  const duz = (base64 + dolgu).replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(duz);
  const dizi = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) dizi[i] = ham.charCodeAt(i);
  return dizi;
}

async function swHazir(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker yok");
  }
  const mevcut = await navigator.serviceWorker.getRegistration("/");
  if (mevcut) return mevcut;
  return navigator.serviceWorker.register("/sw.js");
}

export default function PushIzinButonu({
  acikAnahtar,
}: {
  acikAnahtar: string | null;
}) {
  const [hal, setHal] = useState<Hal>("kontrol");
  const [mesaj, setMesaj] = useState("");

  useEffect(() => {
    let iptal = false;
    const uygula = (yeniHal: Hal, yeniMesaj = "") => {
      if (iptal) return;
      setHal(yeniHal);
      setMesaj(yeniMesaj);
    };

    Promise.resolve().then(async () => {
      if (!acikAnahtar) {
        return uygula(
          "desteklenmiyor",
          "Sunucuda VAPID anahtarları yok. VPS .env'e VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ekle (npm run push:kur)."
        );
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return uygula(
          "desteklenmiyor",
          "Bu tarayıcı push desteklemiyor. iPhone'da: Safari → Paylaş → Ana Ekrana Ekle, sonra oradan aç."
        );
      }
      if (Notification.permission === "denied") return uygula("reddedildi");

      try {
        const kayit = await swHazir();
        await navigator.serviceWorker.ready;
        const abone = await kayit.pushManager.getSubscription();
        uygula(abone ? "acik" : "kapali");
      } catch {
        uygula("kapali");
      }
    });

    return () => {
      iptal = true;
    };
  }, [acikAnahtar]);

  async function ac() {
    if (!acikAnahtar) return;
    setHal("kontrol");
    setMesaj("");
    try {
      const kayit = await swHazir();
      await navigator.serviceWorker.ready;

      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setHal("reddedildi");
        return;
      }

      let abone = await kayit.pushManager.getSubscription();
      if (!abone) {
        abone = await kayit.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidAnahtar(acikAnahtar) as BufferSource,
        });
      }

      const cevap = await fetch("/api/push/abone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...abone.toJSON(), cihaz: navigator.userAgent }),
      });
      const govde = (await cevap.json().catch(() => ({}))) as {
        hata?: string;
      };
      if (!cevap.ok) {
        throw new Error(govde.hata || "Sunucu kaydı başarısız");
      }

      setHal("acik");
    } catch (hata) {
      setHal("hata");
      setMesaj(hata instanceof Error ? hata.message : "Bildirim açılamadı.");
    }
  }

  async function kapat() {
    setHal("kontrol");
    try {
      const kayit = await swHazir();
      const abone = await kayit.pushManager.getSubscription();
      if (abone) {
        await fetch(
          `/api/push/abone?endpoint=${encodeURIComponent(abone.endpoint)}`,
          { method: "DELETE" }
        );
        await abone.unsubscribe();
      }
      setHal("kapali");
    } catch {
      setHal("hata");
      setMesaj("Bildirim kapatılamadı.");
    }
  }

  if (hal === "desteklenmiyor") {
    return <p className="text-sm text-fog">{mesaj}</p>;
  }
  if (hal === "reddedildi") {
    return (
      <p className="text-sm text-fog">
        Bildirim izni tarayıcıda engellenmiş. Site ayarlarından izin verip sayfayı
        yenile.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {hal === "acik" ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-ok/35 bg-ok/12 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ok">
            Bildirim açık
          </span>
          <button
            type="button"
            onClick={kapat}
            className="text-sm font-semibold text-fog hover:text-ember"
          >
            Bu cihazda kapat
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={hal === "kontrol"}
          onClick={ac}
          className="btn btn-teal disabled:opacity-60"
        >
          {hal === "kontrol" ? "Kontrol ediliyor..." : "Bu cihazda bildirimi aç"}
        </button>
      )}
      {hal === "hata" && <p className="text-sm text-ember">{mesaj}</p>}
      <p className="text-[11px] text-fog">
        Android Chrome veya iPhone (Ana Ekrana Eklenmiş) gerekir. Masaüstü de
        çalışır.
      </p>
    </div>
  );
}
