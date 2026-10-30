"use client";

import { useCallback, useEffect, useState } from "react";

const BENIM_SURUM = process.env.UYGULAMA_SURUM;
const KONTROL_MS = 3 * 60 * 1000;

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

/** Menüdeki elle güncelleme: her zaman çalışır, yeni sürüm olmasa da tazeler. */
export function GuncelleDugmesi({ className = "" }: { className?: string }) {
  const [bekliyor, setBekliyor] = useState(false);
  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => {
        setBekliyor(true);
        void uygulamayiGuncelle();
      }}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] text-paper hover:bg-white/[0.05] active:bg-white/[0.08] ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 text-amber ${bekliyor ? "animate-spin" : ""}`}>
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </svg>
      <span className="flex-1">{bekliyor ? "Güncelleniyor…" : "Uygulamayı güncelle"}</span>
      <span className="text-xs text-fog">v{BENIM_SURUM?.slice(0, 7) ?? "?"}</span>
    </button>
  );
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

/** Yeni sürüm yayınlanınca altta "Güncelle" çubuğu; güncellenene kadar kalır. */
export default function Guncelleme() {
  const [yeniVar, setYeniVar] = useState(false);
  const [guncelleniyor, setGuncelleniyor] = useState(false);

  const guncelle = useCallback(() => {
    setGuncelleniyor(true);
    void uygulamayiGuncelle();
  }, []);

  useEffect(() => {
    // Bildirimden gelindiyse (/?guncelle=1) hemen güncelle
    if (new URLSearchParams(window.location.search).has("guncelle")) {
      guncelle();
      return;
    }
    let iptal = false;
    const kontrol = async () => {
      if (document.visibilityState !== "visible") return;
      const s = await sunucuSurumu();
      if (!iptal && s && BENIM_SURUM && s !== BENIM_SURUM) setYeniVar(true);
    };
    void kontrol();
    const zamanlayici = setInterval(() => void kontrol(), KONTROL_MS);
    document.addEventListener("visibilitychange", kontrol);
    return () => {
      iptal = true;
      clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", kontrol);
    };
  }, [guncelle]);

  if (!yeniVar && !guncelleniyor) return null;

  return (
    <div
      role="status"
      className="guncelleme-cubuk fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#2c2c2e]/95 px-4 py-3 text-sm text-paper shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${guncelleniyor ? "animate-spin" : ""}`}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-semibold">{guncelleniyor ? "Güncelleniyor…" : "Güncelleme hazır"}</span>
        {!guncelleniyor && <span className="block text-xs text-fog">Yeni özellikler ve düzeltmeler</span>}
      </span>
      {!guncelleniyor && (
        <button type="button" onClick={guncelle} className="btn btn-amber shrink-0 !px-4 !py-2 text-sm">
          Güncelle
        </button>
      )}
    </div>
  );
}
