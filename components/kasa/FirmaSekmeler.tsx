"use client";

import { AnimatePresence, m } from "motion/react";
import { useState, type ReactNode } from "react";

const SEKMELER = [
  { kod: "sefer", ad: "Seferler", yol: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
  { kod: "odeme", ad: "Ödemeler", yol: "M3 8a2 2 0 0 1 2-2h13v3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 13h2" },
  { kod: "detay", ad: "Detaylar", yol: "M5 7h14M5 12h14M5 17h14" },
] as const;

type Kod = (typeof SEKMELER)[number]["kod"];

/** Firma ayrıntısı sekmeleri; içerikler sunucuda hazırlanır, burada yalnız geçiş yapılır. */
export default function FirmaSekmeler({
  acikSeferler,
  kapaliSeferler,
  kapaliSayi,
  acikSayi,
  odemeler,
  detay,
}: {
  acikSeferler: ReactNode;
  kapaliSeferler: ReactNode;
  acikSayi: number;
  kapaliSayi: number;
  odemeler: ReactNode;
  detay: ReactNode;
}) {
  const [sekme, setSekme] = useState<Kod>("sefer");
  // Açık sefer yoksa doğrudan tümü görünsün
  const [tumu, setTumu] = useState(acikSayi === 0);

  return (
    <div>
      <div className="ks-sekmeler" role="tablist" aria-label="Firma ayrıntıları">
        {SEKMELER.map((s) => {
          const secili = s.kod === sekme;
          return (
            <button key={s.kod} type="button" role="tab" aria-selected={secili} onClick={() => setSekme(s.kod)} className={`ks-sekme ${secili ? "text-[#3730a3]" : ""}`}>
              {secili && <m.span layoutId="firma-sekme" className="ks-sekme-zemin" transition={{ type: "spring", stiffness: 480, damping: 40 }} aria-hidden />}
              <span className={`ks-sekme-ikon ${secili ? "ks-sekme-ikon-aktif" : ""}`} aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.yol} />
                </svg>
              </span>
              <span className="relative">{s.ad}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div key={sekme} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="mt-4">
          {sekme === "sefer" && (
            <section aria-labelledby="firma-seferler">
              <div className="flex items-baseline justify-between px-1">
                <h2 id="firma-seferler" className="ana-baslik">
                  {tumu ? "Tüm seferler" : "Açık seferler"}
                </h2>
                {kapaliSayi > 0 && acikSayi > 0 && (
                  <button type="button" onClick={() => setTumu((t) => !t)} className="ana-link text-[13px]">
                    {tumu ? "Yalnız açıklar" : "Tümü →"}
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-3">
                {acikSeferler}
                {tumu && kapaliSeferler}
                {acikSayi === 0 && kapaliSayi === 0 && (
                  <div className="rounded-[1.4rem] bg-white px-5 py-8 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">Bu firmaya henüz sefer kaydı yok.</div>
                )}
              </div>
            </section>
          )}
          {sekme === "odeme" && odemeler}
          {sekme === "detay" && detay}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
