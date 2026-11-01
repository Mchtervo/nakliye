"use client";

import Link from "next/link";
import { m } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

export type RotaCip = { etiket: string; nereden: string; nereye: string };
export type SekmeOge = { kod: string; ad: string; href: string; rozet: number | null };

function gezinmeBaslat() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("gezinme-basla"));
}

function PinIkon({ renk }: { renk: string }) {
  return (
    <svg viewBox="0 0 24 30" className="h-6 w-5 shrink-0" aria-hidden>
      <path d="M12 1C6 1 1.5 5.5 1.5 11.2 1.5 19 12 29 12 29s10.5-10 10.5-17.8C22.5 5.5 18 1 12 1z" fill={renk} />
      <circle cx="12" cy="11" r="4" fill="#fff" />
    </svg>
  );
}

/**
 * Başlığın üstüne binen beyaz tepsi: Nereden / Nereye (URL'ye yazar, GET),
 * sekmeler (vurgu dokununca kayar) ve hızlı rota çipleri.
 * `ust` verilirse arama alanları yerine o gösterilir (Dönüş sekmesi).
 */
export default function AramaTepsisi({
  sekme,
  nereden,
  nereye,
  cipler,
  sekmeler,
  ust,
  alanlar = true,
}: {
  /** false: arama alanları ve çipler gizli (Takip listesi) */
  alanlar?: boolean;
  sekme: string;
  nereden: string;
  nereye: string;
  cipler: RotaCip[];
  sekmeler: SekmeOge[];
  ust?: ReactNode;
}) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [from, setFrom] = useState(nereden);
  const [to, setTo] = useState(nereye);
  const [aktif, setAktif] = useState(sekme);
  const [onceki, setOnceki] = useState({ nereden, nereye, sekme });
  if (onceki.nereden !== nereden || onceki.nereye !== nereye || onceki.sekme !== sekme) {
    setOnceki({ nereden, nereye, sekme });
    setFrom(nereden);
    setTo(nereye);
    setAktif(sekme);
  }

  function git(n: string, v: string) {
    const p = new URLSearchParams();
    p.set("sekme", sekme);
    if (n.trim()) p.set("nereden", n.trim());
    if (v.trim()) p.set("nereye", v.trim());
    gezinmeBaslat();
    baslat(() => router.push(`/ai/yukler?${p.toString()}`));
  }

  const filtreVar = Boolean(nereden || nereye);

  return (
    <div className="yuk-tepsi ana-gir" style={{ animationDelay: "80ms" }}>
      {!alanlar ? null : ust ?? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            git(from, to);
          }}
        >
          <div className="flex items-stretch gap-1.5">
            <label className="yuk-alan">
              <PinIkon renk="#4f6bff" />
              <span className="min-w-0 flex-1">
                <span className="yuk-alan-etiket">Nereden</span>
                <input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="Ankara, Ostim…"
                  disabled={bekliyor}
                  autoComplete="off"
                  enterKeyHint="search"
                  className="yuk-alan-girdi"
                />
              </span>
              {from && (
                <button type="button" aria-label="Nereden'i temizle" onClick={() => setFrom("")} className="yuk-alan-x">
                  ✕
                </button>
              )}
            </label>
            <button
              type="button"
              aria-label="Nereden ile nereyeyi değiştir"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              className="yuk-degistir"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M4 8h14l-3-3M20 16H6l3 3" />
              </svg>
            </button>
            <label className="yuk-alan">
              <PinIkon renk="#8b5cf6" />
              <span className="min-w-0 flex-1">
                <span className="yuk-alan-etiket">Nereye</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Bolu, Gerede…"
                  disabled={bekliyor}
                  autoComplete="off"
                  enterKeyHint="search"
                  className="yuk-alan-girdi"
                />
              </span>
              {to && (
                <button type="button" aria-label="Nereye'yi temizle" onClick={() => setTo("")} className="yuk-alan-x">
                  ✕
                </button>
              )}
            </label>
          </div>
          {/* Ara: yalnız alan değişince (Enter da arar); ✕ ile boşaltıp Ara = filtreyi kaldır */}
          {(from !== nereden || to !== nereye) && (
            <div className="mt-2 flex gap-2">
              <button type="submit" disabled={bekliyor} className="ana-ana-dugme !min-h-10 flex-1 !text-[14px] disabled:opacity-60">
                {bekliyor ? "Aranıyor…" : "Ara"}
              </button>
              {filtreVar && (
                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={() => {
                    setFrom(nereden);
                    setTo(nereye);
                  }}
                  className="ana-hap !min-h-10 !px-4"
                >
                  Vazgeç
                </button>
              )}
            </div>
          )}
        </form>
      )}

      <div className={`yuk-sekmeler ${alanlar ? "mt-3" : ""}`} role="tablist" aria-label="İlan listesi">
        {sekmeler.map((s) => {
          const secili = s.kod === aktif;
          return (
            <Link
              key={s.kod}
              href={s.href}
              role="tab"
              aria-selected={secili}
              onClick={() => {
                setAktif(s.kod);
                gezinmeBaslat();
              }}
              className={`yuk-sekme ${secili ? "yuk-sekme-aktif" : ""}`}
            >
              {secili && (
                <m.span
                  layoutId="yuk-sekme-vurgu"
                  className="yuk-sekme-vurgu"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                />
              )}
              <span className="relative">
                {s.ad}
                {s.rozet !== null && s.rozet > 0 && <span className="yuk-sekme-rozet">{s.rozet}</span>}
              </span>
            </Link>
          );
        })}
      </div>

      {alanlar && !ust && cipler.length > 0 && (
        <div className="-mx-3 mt-2.5 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
          {cipler.map((c) => {
            const secili =
              nereden.toLocaleLowerCase("tr-TR") === c.nereden.toLocaleLowerCase("tr-TR") &&
              nereye.toLocaleLowerCase("tr-TR") === c.nereye.toLocaleLowerCase("tr-TR");
            const p = new URLSearchParams();
            p.set("sekme", sekme);
            p.set("nereden", c.nereden);
            p.set("nereye", c.nereye);
            return (
              <Link
                key={c.etiket}
                href={`/ai/yukler?${p.toString()}`}
                onClick={gezinmeBaslat}
                className={`ana-cip !min-h-8 shrink-0 whitespace-nowrap !px-3 !text-[12.5px] ${secili ? "" : "ana-cip-oneri"}`}
              >
                {c.etiket}
              </Link>
            );
          })}
        </div>
      )}

      {bekliyor && (
        <div role="status" className="yuk-tepsi-bekle">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--a-indigo)] border-t-transparent" />
          Yük aranıyor…
        </div>
      )}
    </div>
  );
}
