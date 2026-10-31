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
  tema = "koyu",
}: {
  /** "acik": ana sayfanın "Her zaman yanında" kartı */
  tema?: "koyu" | "acik";
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

  if (tema === "acik" && !ayarlarda) {
    return (
      <section id="telefon-tuslari" className="ana-yaninda ana-gir" style={{ animationDelay: "420ms" }} aria-labelledby="her-zaman">
        <div className="flex min-w-0 items-center gap-3">
          <span className="ana-telefon-ikon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
              <path d="M11 18.5h2" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="her-zaman" className="text-[16.5px] font-extrabold tracking-[-0.01em]">Her zaman yanında</h2>
            <p className="text-[12.5px] leading-snug text-[var(--a-ikincil)]">Ana ekranına ekle, yeni yüklerden haber al.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {eklendi ? (
            <p className="rounded-full bg-[#dcfce7] px-4 py-2 text-center text-[13px] font-bold text-[#15803d]">✓ Ana ekranda kurulu</p>
          ) : (
            <button type="button" onClick={() => void ekle()} className="ana-ana-dugme !min-h-10 !text-[14px]">
              Ana ekrana ekle
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <PushIzinButonu
              tema="acik"
              acikAnahtar={acikAnahtar}
              onAcildi={() => setTimeout(() => setBildirimAcik(true), 1200)}
            />
            <TestBildirimButonu tema="acik" />
          </div>
          {mesaj && <p className="text-[12.5px] font-bold text-[#16a34a]">{mesaj}</p>}
        </div>
        {yardim && !eklendi && (
          <div className="col-span-full rounded-2xl bg-[#eef1fb] px-3 py-3 text-[13px] text-[var(--a-ikincil)]">
            <p className="font-bold text-[var(--a-murekkep)]">{ios ? "iPhone / iPad" : "Android / Chrome"}</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
              {ios ? (
                <>
                  <li>Alttaki <b>Paylaş</b> (kare ve ok)</li>
                  <li><b>Ana Ekrana Ekle</b></li>
                  <li>Ekle — ikondan aç, bildirimi buradan aç</li>
                </>
              ) : (
                <>
                  <li>Sağ üst <b>⋮</b> menü</li>
                  <li><b>Ana ekrana ekle</b> veya <b>Uygulamayı yükle</b></li>
                  <li>Ekle — sonra bu sayfada Bildirimi aç</li>
                </>
              )}
            </ol>
            <button type="button" onClick={() => setYardim(false)} className="ana-link mt-2">Tamam</button>
          </div>
        )}
      </section>
    );
  }

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
