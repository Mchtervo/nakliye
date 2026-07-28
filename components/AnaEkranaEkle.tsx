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
      <section className="kart space-y-2 p-4 sm:p-5 reveal">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-teal">
          Ana ekran
        </div>
        <h2 className="font-display text-xl font-bold text-paper">
          Uygulama kurulu
        </h2>
        <p className="text-sm font-medium text-fog">
          Ana ekrandaki <strong className="text-paper">Nakliye</strong> ikonuna
          bas → direkt panele girersin.
        </p>
        {mesaj && <p className="text-sm font-bold text-ok">{mesaj}</p>}
      </section>
    );
  }

  return (
    <section className="kart space-y-3 p-4 sm:p-5 reveal">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-amber">
          Ana ekran kısayolu
        </div>
        <h2 className="font-display text-xl font-bold text-paper">
          Telefona / masaüstüne ekle
        </h2>
        <p className="mt-1 text-sm font-medium text-fog">
          İkon ana ekrana gelir. Tıklayınca tarayıcı değil, uygulama gibi açılır.
        </p>
      </div>

      {deferred ? (
        <button type="button" onClick={yukle} className="btn btn-amber btn-block">
          Ana ekrana ekle
        </button>
      ) : iosMu ? (
        <div className="rounded-xl border border-black/10 bg-[#eef3f2] px-3 py-3 text-sm font-medium text-fog">
          <p className="font-bold text-paper">iPhone / iPad:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              Alttaki <strong className="text-paper">Paylaş</strong> (kare↑)
              butonuna bas
            </li>
            <li>
              <strong className="text-paper">Ana Ekrana Ekle</strong> seç
            </li>
            <li>Ekle → ana ekranda Nakliye ikonu çıkar</li>
          </ol>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-black/10 bg-[#eef3f2] px-3 py-3 text-sm font-medium text-fog">
            <p className="font-bold text-paper">Android / Chrome:</p>
            <p className="mt-1">
              Menü (⋮) → <strong className="text-paper">Uygulamayı yükle</strong>{" "}
              veya <strong className="text-paper">Ana ekrana ekle</strong>
            </p>
            <p className="mt-2 font-bold text-paper">Windows bilgisayar:</p>
            <p className="mt-1">
              Adres çubuğundaki <strong className="text-paper">⊕ Yükle</strong>{" "}
              ikonuna bas
            </p>
          </div>
          <p className="text-sm font-medium text-fog">
            Buton çıkmazsa Chrome ile açıp bir kez yenile.
          </p>
        </div>
      )}

      {mesaj && <p className="text-sm font-bold text-ok">{mesaj}</p>}
    </section>
  );
}
