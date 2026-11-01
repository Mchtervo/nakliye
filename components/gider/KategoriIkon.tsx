import type { ReactNode } from "react";

const YOL: Record<string, ReactNode> = {
  yakit: (
    <>
      <path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M4 20h12M8 9h4" />
      <path d="M15 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3" />
    </>
  ),
  anahtar: <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5l3 3 5.7-5.7a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z" />,
  kart: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  yol: <path d="M9 3 6 21M15 3l3 18M12 5v2M12 11v2M12 17v2" />,
  tir: (
    <>
      <path d="M1.5 7.5h11v8h-11zM12.5 10.5h4l3 3v2h-7" />
      <circle cx="5.5" cy="17" r="1.6" />
      <circle cx="16.5" cy="17" r="1.6" />
    </>
  ),
  kalkan: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />,
  diger: (
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>
  ),
};

/** Gider kategorisi → ikon + ton (yakıt kırmızı, bakım mavi, kredi turuncu…). */
export function kategoriGorunum(kod: string): { yol: ReactNode; ton: string } {
  if (kod === "YAKIT") return { yol: YOL.yakit, ton: "ana-ton-kirmizi" };
  if (["BAKIM", "TAMIR", "LASTIK"].includes(kod)) return { yol: YOL.anahtar, ton: "ana-ton-indigo" };
  if (kod === "KREDI_ODEME") return { yol: YOL.kart, ton: "ana-ton-turuncu" };
  if (["OGS", "HGS", "OTOYOL"].includes(kod)) return { yol: YOL.yol, ton: "ana-ton-indigo" };
  if (kod === "DEMIRBAS") return { yol: YOL.tir, ton: "ana-ton-yesil" };
  if (["KASKO", "TRAFIK_SIGORTA", "MUAYENE", "MTV", "SIGORTA", "VERGI"].includes(kod)) return { yol: YOL.kalkan, ton: "ana-ton-yesil" };
  return { yol: YOL.diger, ton: "ana-ton-gri" };
}

export default function KategoriIkon({ kod, buyuk = false }: { kod: string; buyuk?: boolean }) {
  const g = kategoriGorunum(kod);
  return (
    <span className={`ana-mini-ikon ${g.ton} ${buyuk ? "!h-11 !w-11 !rounded-2xl" : ""}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={buyuk ? "!h-6 !w-6" : ""}>
        {g.yol}
      </svg>
    </span>
  );
}
