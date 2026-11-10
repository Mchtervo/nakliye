"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";
import FirmaDuzenle from "@/components/kasa/FirmaDuzenle";
import { tlYazKisa } from "@/lib/para";

export type CariSatir = {
  id: number;
  ad: string;
  anlasilan: number;
  odenen: number;
  kalan: number;
  yukSayisi: number;
  acikYuk: number;
};

const kucuk = (s: string) => s.toLocaleLowerCase("tr-TR");

/** Cari listesi: Tümü / Açık hesaplar ve firma araması (ekranda süzer, kayıtlara dokunmaz). */
export default function CariListe({ cariler }: { cariler: CariSatir[] }) {
  const [sadeceAcik, setSadeceAcik] = useState(false);
  const [ara, setAra] = useState("");
  const gorunen = cariler.filter((c) => (!sadeceAcik || c.kalan > 0) && (!ara.trim() || kucuk(c.ad).includes(kucuk(ara.trim()))));

  return (
    <div>
      <div className="sf-segment !w-fit" role="group" aria-label="Cari süzgeci">
        {(
          [
            [false, "Tümü"],
            [true, "Açık hesaplar"],
          ] as const
        ).map(([deger, ad]) => {
          const secili = sadeceAcik === deger;
          return (
            <button key={ad} type="button" aria-pressed={secili} onClick={() => setSadeceAcik(deger)} className={`sf-segment-oge relative whitespace-nowrap !px-4 ${secili ? "!text-[#3730a3]" : ""}`}>
              {secili && <m.span layoutId="cari-suz" className="absolute inset-0 rounded-full bg-white shadow-[0_6px_14px_-8px_rgba(28,38,110,0.45)]" transition={{ type: "spring", stiffness: 520, damping: 42 }} aria-hidden />}
              <span className="relative">{ad}</span>
            </button>
          );
        })}
      </div>

      <div className="sf-alan mt-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-5 w-5 shrink-0 text-[#4f46e5]" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4-4" />
        </svg>
        <input value={ara} onChange={(e) => setAra(e.target.value)} type="search" placeholder="Firma ara" aria-label="Firma ara" className="sf-girdi" />
      </div>

      {cariler.length === 0 ? (
        <div className="mt-3 rounded-[1.4rem] bg-white px-5 py-8 text-center text-[14.5px] text-[#3b4262] shadow-[var(--a-golge)]">
          Henüz firma yok. İlk seferi yazınca cari oluşur.
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          <AnimatePresence initial={false}>
            {gorunen.map((c) => (
              <m.li key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="flex items-center gap-2">
                <Link href={`/firmalar/${c.id}`} className="ks-cari min-w-0 flex-1">
                  <FirmaAvatar id={c.id} ad={c.ad} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-extrabold tracking-[-0.01em]">{c.ad}</span>
                    <span className="block text-[12.5px] text-[var(--a-ikincil)]">
                      {c.acikYuk > 0 ? `${c.acikYuk} açık sefer` : c.yukSayisi > 0 ? "Hepsi tahsil edildi" : "Sefer yok"}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[16px] font-extrabold tabular-nums ${c.kalan > 0 ? "" : "text-[#15803d]"}`}>{c.kalan > 0 ? tlYazKisa(c.kalan) : "Tamam"}</span>
                  <span className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
                    ›
                  </span>
                </Link>
                <FirmaDuzenle ikon acikZemin firma={{ id: c.id, ad: c.ad }} />
              </m.li>
            ))}
          </AnimatePresence>
          {gorunen.length === 0 && <li className="px-2 py-6 text-center text-[14px] text-[var(--a-ikincil)]">Bu aramaya uyan firma yok.</li>}
        </ul>
      )}
    </div>
  );
}
