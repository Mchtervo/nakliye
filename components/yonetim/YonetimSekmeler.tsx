"use client";

import { m } from "motion/react";
import Link from "next/link";

const SEKMELER = [
  { kod: "genel", ad: "Genel", href: "/yonetim", yol: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5" },
  { kod: "uyeler", ad: "Üyeler", href: "/yonetim/uyeler", yol: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c.7-3.3 3-5 6-5s5.3 1.7 6 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c1.6.6 2.6 2.2 3 5" },
  { kod: "ilanlar", ad: "İlanlar", href: "/yonetim/ilanlar", yol: "M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h3" },
  { kod: "sistem", ad: "Sistem", href: "/yonetim/sistem", yol: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" },
] as const;

/** Yönetim sekmeleri: seçili sekmenin zemini kayar. */
export default function YonetimSekmeler({ aktif, rozet }: { aktif: string; rozet?: Partial<Record<string, number>> }) {
  return (
    <nav className="yn-sekmeler" aria-label="Yönetim bölümleri">
      {SEKMELER.map((s) => {
        const secili = s.kod === aktif;
        const r = rozet?.[s.kod] ?? 0;
        return (
          <Link key={s.kod} href={s.href} aria-current={secili ? "page" : undefined} className={`yn-sekme ${secili ? "text-[#3730a3]" : ""}`}>
            {secili && <m.span layoutId="yonetim-sekme" className="ks-sekme-zemin" transition={{ type: "spring", stiffness: 480, damping: 40 }} aria-hidden />}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative h-5 w-5" aria-hidden>
              <path d={s.yol} />
            </svg>
            <span className="relative">{s.ad}</span>
            {r > 0 && <span className="yn-rozet">{r > 99 ? "99+" : r}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
