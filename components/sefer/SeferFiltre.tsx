"use client";

import { AnimatePresence, m } from "motion/react";
import { Children, useMemo, useState, type ReactNode } from "react";
import { tlYazKisa } from "@/lib/para";

export type SeferFiltreBilgi = {
  id: number;
  /** Firma, şoför/plaka, nereden, nereye, açıklama, telefon — küçük harfle birleşik */
  metin: string;
  toplam: number;
  odenen: number;
  kdvli: boolean;
  pesin: boolean;
};

type Filtre = "TUM" | "ODENEN" | "ODENMEYEN" | "KISMI" | "PESIN" | "KDVLI" | "KDVSIZ";

const FILTRELER: [Filtre, string][] = [
  ["TUM", "Tümü"],
  ["ODENMEYEN", "Parası alınmayan"],
  ["ODENEN", "Parası alınan"],
  ["KISMI", "Kısmi ödenen"],
  ["PESIN", "Peşin"],
  ["KDVLI", "KDV'li"],
  ["KDVSIZ", "KDV'siz"],
];

const kucuk = (s: string) => s.toLocaleLowerCase("tr-TR");

function uyar(b: SeferFiltreBilgi, f: Filtre): boolean {
  const kalan = b.toplam - b.odenen;
  switch (f) {
    case "ODENEN":
      return kalan <= 0;
    case "ODENMEYEN":
      return kalan > 0;
    case "KISMI":
      return kalan > 0 && b.odenen > 0;
    case "PESIN":
      return b.pesin;
    case "KDVLI":
      return b.kdvli;
    case "KDVSIZ":
      return !b.kdvli;
    default:
      return true;
  }
}

/** Sefer kartlarını arama + durum filtresiyle süzer. children sırası `bilgiler` ile aynı olmalı. */
export default function SeferFiltre({ bilgiler, children }: { bilgiler: SeferFiltreBilgi[]; children: ReactNode }) {
  const [arama, setArama] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("TUM");
  const kartlar = Children.toArray(children);

  const sayilar = useMemo(() => {
    const s = {} as Record<Filtre, number>;
    for (const [f] of FILTRELER) s[f] = bilgiler.filter((b) => uyar(b, f)).length;
    return s;
  }, [bilgiler]);

  const kelimeler = kucuk(arama).split(/\s+/).filter(Boolean);
  const gorunen = bilgiler
    .map((b, i) => ({ b, kart: kartlar[i] }))
    .filter(({ b }) => uyar(b, filtre) && kelimeler.every((k) => b.metin.includes(k)));
  const suzuldu = filtre !== "TUM" || kelimeler.length > 0;
  const toplam = gorunen.reduce((t, x) => t + x.b.toplam, 0);
  const odenen = gorunen.reduce((t, x) => t + Math.min(x.b.odenen, x.b.toplam), 0);

  return (
    <>
      <div className="mt-3 space-y-2.5">
        <div className="sf-alan !bg-white shadow-[var(--a-golge)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 shrink-0 text-[#8a90ad]" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            type="search"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Firma, şoför, plaka, şehir ara…"
            aria-label="Seferlerde ara"
            className="sf-girdi"
          />
          {arama && (
            <button type="button" onClick={() => setArama("")} aria-label="Aramayı temizle" className="px-1 text-[18px] leading-none text-[#8a90ad]">
              ×
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {FILTRELER.map(([f, ad]) => {
            const secili = filtre === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFiltre(f)}
                aria-pressed={secili}
                className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${secili ? "text-white" : "bg-white text-[#3b4262] shadow-[var(--a-golge)]"}`}
              >
                {secili && <m.span layoutId="sefer-filtre" className="absolute inset-0 rounded-full bg-[#4f46e5]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">
                  {ad} <span className={secili ? "text-white/75" : "text-[#8a90ad]"}>{sayilar[f]}</span>
                </span>
              </button>
            );
          })}
        </div>
        <AnimatePresence initial={false}>
          {suzuldu && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white px-3 py-2.5 text-center shadow-[var(--a-golge)]">
                <div>
                  <p className="text-[11.5px] text-[var(--a-ikincil)]">{gorunen.length} sefer</p>
                  <p className="text-[14.5px] font-extrabold tabular-nums">{tlYazKisa(toplam)}</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[var(--a-ikincil)]">Alınan</p>
                  <p className="text-[14.5px] font-extrabold tabular-nums text-[#16a34a]">{tlYazKisa(odenen)}</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[var(--a-ikincil)]">Alınacak</p>
                  <p className="text-[14.5px] font-extrabold tabular-nums text-[#ea580c]">{tlYazKisa(Math.max(0, toplam - odenen))}</p>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {gorunen.length === 0 ? (
        <div className="mt-3 rounded-[1.4rem] bg-white px-5 py-8 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">
          Bu aramaya uyan sefer yok.
        </div>
      ) : (
        <div className="mt-3 space-y-3 pb-6">{gorunen.map((x) => x.kart)}</div>
      )}
    </>
  );
}
