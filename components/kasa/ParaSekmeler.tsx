"use client";

import { m } from "motion/react";
import Link from "next/link";

const SEKMELER = [
  { kod: "ozet", ad: "Özet", yol: "M4 5h16v14H4zM4 9h16M9 13h6M9 16h4" },
  { kod: "kasa", ad: "Kasa", yol: "M3 8a2 2 0 0 1 2-2h13v3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 13h2" },
  { kod: "cari", ad: "Cariler", yol: "M12 4c4 0 7 1.3 7 3s-3 3-7 3-7-1.3-7-3 3-3 7-3zM5 7v5c0 1.7 3 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3 3 7 3s7-1.3 7-3v-5" },
] as const;

/** Kasa & Cari sekmeleri: seçili sekmenin zemini yumuşakça kayar. */
export default function ParaSekmeler({ aktif, onEk = "/para" }: { aktif: string; onEk?: string }) {
  return (
    <nav className="ks-sekmeler" aria-label="Kasa ve cari sekmeleri">
      {SEKMELER.map((s) => {
        const secili = s.kod === aktif;
        return (
          <Link key={s.kod} href={`${onEk}?sekme=${s.kod}`} aria-current={secili ? "page" : undefined} className={`ks-sekme ${secili ? "text-[#3730a3]" : ""}`}>
            {secili && <m.span layoutId="para-sekme" className="ks-sekme-zemin" transition={{ type: "spring", stiffness: 480, damping: 40 }} aria-hidden />}
            <span className={`ks-sekme-ikon ${secili ? "ks-sekme-ikon-aktif" : ""}`} aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={s.yol} />
              </svg>
            </span>
            <span className="relative">{s.ad}</span>
          </Link>
        );
      })}
    </nav>
  );
}
