"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const BENIM_SURUM = process.env.UYGULAMA_SURUM;
const KONTROL_MS = 3 * 60 * 1000;
/** Sayfa bu kadar süre önce açıldıysa eski sürüm hemen tazelenir (kullanıcı henüz bir şey yazmamıştır). */
const ACILIS_PENCERESI_MS = 6000;
/** Yenileme döngüsüne girmemek için: en fazla 2 dakikada bir. */
const DENEME_ARASI_MS = 2 * 60 * 1000;
const DENEME_ANAHTAR = "nd_guncelleme_deneme";

/**
 * Uygulamayı en yeni sürüme getirir: service worker güncellenir,
 * önbellekler silinir, sayfa ağdan yeniden yüklenir.
 */
export async function uygulamayiGuncelle(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const kayitlar = await navigator.serviceWorker.getRegistrations();
      await Promise.all(kayitlar.map((k) => k.update().catch(() => null)));
    }
    if ("caches" in window) {
      const anahtarlar = await caches.keys();
      await Promise.all(anahtarlar.map((a) => caches.delete(a)));
    }
  } catch {
    /* yenileme yine de yapılsın */
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("guncelle");
  window.location.replace(url.toString());
}

async function sunucuSurumu(): Promise<string | null> {
  try {
    const r = await fetch("/api/surum", { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { surum?: string | null };
    return j.surum ?? null;
  } catch {
    return null;
  }
}

/** Döngü koruması: son denemeden bu yana yeterli süre geçti mi? Geçtiyse yeni deneme zamanını yazar. */
function denemeHakkiVar(): boolean {
  try {
    const son = Number(sessionStorage.getItem(DENEME_ANAHTAR) || 0);
    if (Date.now() - son < DENEME_ARASI_MS) return false;
    sessionStorage.setItem(DENEME_ANAHTAR, String(Date.now()));
  } catch {
    /* sessionStorage yoksa yine de dene */
  }
  return true;
}

/**
 * Sessiz otomatik güncelleme: ekranda düğme, çubuk ya da bildirim YOK.
 * - Sayfa yeni açıldıysa ve sunucuda daha yeni sürüm varsa hemen tazelenir.
 * - Uzun açık kaldıysa, kullanıcı başka sayfaya geçince tazelenir.
 * Sayfanın ortasında asla yenilenmez (yazılan form / çekilen fiş kaybolmasın).
 */
export default function Guncelleme() {
  const yol = usePathname();
  const eskiSurum = useRef(false);
  const acilisZamani = useRef(0);
  const oncekiYol = useRef<string | null>(null);

  // Eski güncelleme bildirimlerine basılırsa (/?guncelle=1) yine tazele
  useEffect(() => {
    acilisZamani.current = Date.now();
    if (new URLSearchParams(window.location.search).has("guncelle") && denemeHakkiVar()) {
      void uygulamayiGuncelle();
    }
  }, []);

  useEffect(() => {
    let iptal = false;
    const kontrol = async () => {
      if (document.visibilityState !== "visible") return;
      const s = await sunucuSurumu();
      if (iptal || !s || !BENIM_SURUM || s === BENIM_SURUM) return;
      eskiSurum.current = true;
      if (Date.now() - acilisZamani.current < ACILIS_PENCERESI_MS && denemeHakkiVar()) void uygulamayiGuncelle();
    };
    void kontrol();
    const zamanlayici = setInterval(() => void kontrol(), KONTROL_MS);
    document.addEventListener("visibilitychange", kontrol);
    return () => {
      iptal = true;
      clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", kontrol);
    };
  }, []);

  // Eski sürümdeyken kullanıcı başka sayfaya geçtiyse, yeni sayfayı yeni sürümle aç
  useEffect(() => {
    if (oncekiYol.current !== null && oncekiYol.current !== yol && eskiSurum.current && denemeHakkiVar()) {
      void uygulamayiGuncelle();
    }
    oncekiYol.current = yol;
  }, [yol]);

  return null;
}
