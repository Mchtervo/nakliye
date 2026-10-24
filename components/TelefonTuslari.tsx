"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { kurPromptuOku, kurPromptunaAbone, type KurPrompt } from "@/lib/pwaKur";
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

export default function TelefonTuslari({
  acikAnahtar,
  excelHref,
}: {
  acikAnahtar: string | null;
  excelHref: string;
}) {
  const [prompt, setPrompt] = useState<KurPrompt | null>(null);
  const [kurulu, setKurulu] = useState(false);
  const [yardim, setYardim] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const standalone = useSyncExternalStore(standaloneAbone, standaloneMi, () => false);
  const ios = useSyncExternalStore(bosAbone, iosMu, () => false);

  useEffect(() => {
    setPrompt(kurPromptuOku());
    return kurPromptunaAbone(setPrompt);
  }, []);

  useEffect(() => {
    const bitti = () => {
      setKurulu(true);
      setPrompt(null);
      setMesaj("Eklendi. Ana ekrandaki Nakliye ikonuna bas.");
    };
    window.addEventListener("appinstalled", bitti);
    return () => window.removeEventListener("appinstalled", bitti);
  }, []);

  async function ekle() {
    if (prompt) {
      await prompt.prompt();
      const sonuc = await prompt.userChoice;
      if (sonuc.outcome === "accepted") {
        setKurulu(true);
        setMesaj("Eklendi. Ana ekrandan aç.");
      }
      setPrompt(null);
      return;
    }
    setYardim(true);
  }

  const eklendi = standalone || kurulu;

  return (
    <section id="telefon-tuslari" className="kart space-y-3 p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">
          Telefon / tablet
        </p>
        <h2 className="font-display text-xl font-bold">Ana ekran ve bildirim</h2>
        <p className="mt-1 text-sm text-fog">
          Tuşa bas, ikon ana ekrana gelsin. Bildirimi aç, yeni yük telefona düşsün.
        </p>
      </div>

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
        <a href={excelHref} className="btn btn-teal text-center">
          Bu ayı Excel indir
        </a>
        <a href="/raporlar" className="btn btn-ghost text-center">
          Raporlar
        </a>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <p className="mb-2 text-sm font-semibold">Bildirim</p>
        <PushIzinButonu acikAnahtar={acikAnahtar} />
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
