"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Telefon / masaüstü ana ekranına uygulama kısayolu ekler.
 * Tıklayınca doğrudan panele girilir (PWA).
 */
export default function AnaEkranaEkle() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [kurulu, setKurulu] = useState(false);
  const [iosMu, setIosMu] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (standalone) setKurulu(true);

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIosMu(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setKurulu(true);
      setDeferred(null);
      setMesaj("Eklendi. Artık ana ekrandaki ikona basıp girersin.");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  async function yukle() {
    if (!deferred) return;
    await deferred.prompt();
    const sonuc = await deferred.userChoice;
    if (sonuc.outcome === "accepted") {
      setMesaj("Eklendi. Ana ekrandan Nakliye ikonuna bas.");
      setKurulu(true);
    }
    setDeferred(null);
  }

  if (kurulu) {
    return (
      <section className="kart space-y-2 border-teal/30 p-4 sm:p-5 reveal">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal">
          Ana ekran
        </div>
        <h2 className="font-display text-xl font-bold text-paper">
          Uygulama kurulu
        </h2>
        <p className="text-sm text-fog">
          Telefon veya bilgisayar ana ekranındaki <strong className="text-paper">Nakliye</strong>{" "}
          ikonuna bas → direkt panele girersin.
        </p>
        {mesaj && <p className="text-sm font-semibold text-ok">{mesaj}</p>}
      </section>
    );
  }

  return (
    <section className="kart space-y-3 border-amber/35 bg-amber/5 p-4 sm:p-5 reveal">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">
          Ana ekran kısayolu
        </div>
        <h2 className="font-display text-xl font-bold text-paper">
          Telefona / masaüstüne ekle
        </h2>
        <p className="mt-1 text-sm text-fog">
          İkon ana ekrana gelir. Tıklayınca tarayıcı değil, uygulama gibi açılır —
          direkt panele.
        </p>
      </div>

      {deferred ? (
        <button type="button" onClick={yukle} className="btn btn-amber btn-block">
          Ana ekrana ekle
        </button>
      ) : iosMu ? (
        <div className="rounded-xl border border-white/12 bg-asphalt/50 px-3 py-3 text-sm text-fog">
          <p className="font-semibold text-paper">iPhone / iPad:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Alttaki <strong className="text-paper">Paylaş</strong> (kare↑) butonuna bas</li>
            <li>
              <strong className="text-paper">Ana Ekrana Ekle</strong> seç
            </li>
            <li>Ekle → ana ekranda Nakliye ikonu çıkar</li>
          </ol>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-white/12 bg-asphalt/50 px-3 py-3 text-sm text-fog">
            <p className="font-semibold text-paper">Android / Chrome:</p>
            <p className="mt-1">
              Menü (⋮) → <strong className="text-paper">Uygulamayı yükle</strong> veya{" "}
              <strong className="text-paper">Ana ekrana ekle</strong>
            </p>
            <p className="mt-2 font-semibold text-paper">Windows bilgisayar:</p>
            <p className="mt-1">
              Adres çubuğundaki <strong className="text-paper">⊕ Yükle</strong> / yükle
              ikonuna bas, veya menü → Uygulamayı yükle
            </p>
          </div>
          <p className="text-xs text-fog">
            Buton çıkmazsa sayfayı Chrome ile açıp bir kez yenile.
          </p>
        </div>
      )}

      {mesaj && <p className="text-sm font-semibold text-ok">{mesaj}</p>}
    </section>
  );
}
