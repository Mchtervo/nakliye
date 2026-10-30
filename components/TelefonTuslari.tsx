"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { kurPromptuOku, kurPromptunaAbone, kurPromptunuTemizle } from "@/lib/pwaKur";
import PushIzinButonu from "@/components/PushIzinButonu";
import TestBildirimButonu from "@/components/TestBildirimButonu";

const STANDALONE = "(display-mode: standalone)";
const bosAbone = () => () => {};

function standaloneAbone(degisti: () => void) {
  const mq = window.matchMedia(STANDALONE);
  mq.addEventListener("change", degisti);
  return () => mq.removeEventListener("change", degisti);
}

function standaloneMi() {
  return (
    window.matchMedia(STANDALONE).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function iosMu() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Bu cihazda bildirim izni + push aboneliği var mı? */
async function bildirimAcikMi(): Promise<boolean> {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    const kayit = await navigator.serviceWorker?.getRegistration("/");
    return Boolean(await kayit?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export default function TelefonTuslari({
  acikAnahtar,
  excelHref,
  ayarlarda = false,
}: {
  acikAnahtar: string | null;
  excelHref?: string;
  /** Ayarlar'da hep görünür; ana sayfada iş bitince (kurulu + bildirim açık) gizlenir. */
  ayarlarda?: boolean;
}) {
  const [bildirimAcik, setBildirimAcik] = useState<boolean | null>(null);
  const [kurulu, setKurulu] = useState(false);
  const [yardim, setYardim] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const prompt = useSyncExternalStore(kurPromptunaAbone, kurPromptuOku, () => null);
  const standalone = useSyncExternalStore(standaloneAbone, standaloneMi, () => false);
  const ios = useSyncExternalStore(bosAbone, iosMu, () => false);

  useEffect(() => {
    const bitti = () => {
      setKurulu(true);
      kurPromptunuTemizle();
      setMesaj("Eklendi. Ana ekrandaki Nakliye ikonuna bas.");
    };
    window.addEventListener("appinstalled", bitti);
    let iptal = false;
    void bildirimAcikMi().then((a) => !iptal && setBildirimAcik(a));
    return () => {
      iptal = true;
      window.removeEventListener("appinstalled", bitti);
    };
  }, []);

  async function ekle() {
    if (prompt) {
      await prompt.prompt();
      const sonuc = await prompt.userChoice;
      if (sonuc.outcome === "accepted") {
        setKurulu(true);
        setMesaj("Eklendi. Ana ekrandan aç.");
      }
      kurPromptunuTemizle();
      return;
    }
    setYardim(true);
  }

  const eklendi = standalone || kurulu;

  // Ana sayfa: kontrol bitmeden gösterme (yanıp sönmesin); bu cihazda bildirim
  // açıksa hiç gösterme — her cihazda. Ayarlar'da hep durur.
  if (!ayarlarda && (bildirimAcik === null || bildirimAcik)) return null;

  return (
    <section id="telefon-tuslari" className={ayarlarda ? "space-y-3" : "kart space-y-3 p-4 sm:p-5"}>
      {!ayarlarda && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">
            Telefon / tablet
          </p>
          <h2 className="font-display text-xl font-bold">Ana ekran ve bildirim</h2>
          <p className="mt-1 text-sm text-fog">
            Tuşa bas, ikon ana ekrana gelsin. Bildirimi aç, yeni yük telefona düşsün.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {eklendi ? (
          <p className="rounded-xl border border-ok/30 bg-ok/10 px-3 py-3 text-sm font-semibold text-ok">
            Ana ekranda kurulu
          </p>
        ) : (
          <button type="button" onClick={() => void ekle()} className="btn btn-amber">
            Ana ekrana ekle
          </button>
        )}
        {!ayarlarda && excelHref && (
          <>
            <a href={excelHref} className="btn btn-teal text-center">
              Bu ayı Excel indir
            </a>
            <a href="/raporlar" className="btn btn-ghost text-center">
              Raporlar
            </a>
          </>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <p className="mb-2 text-sm font-semibold">Bildirim</p>
        <PushIzinButonu
          acikAnahtar={acikAnahtar}
          onAcildi={ayarlarda ? undefined : () => setTimeout(() => setBildirimAcik(true), 1200)}
        />
        <div className="mt-3">
          <TestBildirimButonu />
        </div>
      </div>

      {mesaj && <p className="text-sm font-bold text-ok">{mesaj}</p>}

      {yardim && !eklendi && (
        <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-fog">
          {ios ? (
            <>
              <p className="font-bold text-paper">iPhone / iPad</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  Alttaki <strong className="text-paper">Paylaş</strong> (kare ve ok)
                </li>
                <li>
                  <strong className="text-paper">Ana Ekrana Ekle</strong>
                </li>
                <li>Ekle — ikon çıkar, ondan aç, bildirimi buradan aç</li>
              </ol>
            </>
          ) : (
            <>
              <p className="font-bold text-paper">Android / Chrome</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  Sağ üst <strong className="text-paper">⋮</strong> menü
                </li>
                <li>
                  <strong className="text-paper">Ana ekrana ekle</strong> veya{" "}
                  <strong className="text-paper">Uygulamayı yükle</strong>
                </li>
                <li>Ekle — sonra bu sayfada Bildirimi aç</li>
              </ol>
            </>
          )}
          <button
            type="button"
            onClick={() => setYardim(false)}
            className="mt-3 text-sm font-semibold text-amber"
          >
            Tamam
          </button>
        </div>
      )}
    </section>
  );
}
