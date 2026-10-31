"use client";

import Link from "next/link";
import { m } from "motion/react";
import { useState } from "react";

export type Hareket = {
  anahtar: string;
  href: string;
  baslik: string;
  alt: string;
  tarih: string;
  tutar: number;
  gelir: boolean;
  durum: string | null;
  kategori: string | null;
};

const tl = (k: number) => `₺${Math.round(k / 100).toLocaleString("tr-TR")}`;

const YOL = {
  tir: (
    <>
      <path d="M1.5 7.5h11v8h-11z" />
      <path d="M12.5 10.5h4l3 3v2h-7z" />
      <circle cx="5.5" cy="17" r="1.6" />
      <circle cx="16.5" cy="17" r="1.6" />
    </>
  ),
  yakit: (
    <>
      <path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M4 20h12M8 9h4" />
      <path d="M15 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3" />
    </>
  ),
  kart: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  anahtar: <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5l3 3 5.7-5.7a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4z" />,
  fis: (
    <>
      <path d="M7 3h10v18l-2-1.4L13 21l-2-1.4L9 21l-2-1.4L5 21V5a2 2 0 0 1 2-2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
};

function ikonu(h: Hareket): { yol: React.ReactNode; ton: string } {
  if (h.gelir) return { yol: YOL.tir, ton: "ana-ton-indigo" };
  if (h.kategori === "YAKIT") return { yol: YOL.yakit, ton: "ana-ton-kirmizi" };
  if (h.kategori === "KREDI_ODEME") return { yol: YOL.kart, ton: "ana-ton-turuncu" };
  if (["BAKIM", "TAMIR", "LASTIK"].includes(h.kategori || "")) return { yol: YOL.anahtar, ton: "ana-ton-indigo" };
  return { yol: YOL.fis, ton: "ana-ton-gri" };
}

const DURUM: Record<string, { ad: string; renk: string }> = {
  ODENDI: { ad: "Ödendi", renk: "text-[#16a34a]" },
  KISMI: { ad: "Kısmi", renk: "text-[#ea580c]" },
  BEKLIYOR: { ad: "Bekliyor", renk: "text-[#d97706]" },
};

/** Son seferler + giderler; sekmeye basınca süzülür, tekrar basınca hepsi. */
export default function SonHareketler({ hareketler }: { hareketler: Hareket[] }) {
  const [sekme, setSekme] = useState<"sefer" | "gider" | null>(null);
  const liste = hareketler.filter((h) => (sekme === "sefer" ? h.gelir : sekme === "gider" ? !h.gelir : true)).slice(0, 6);

  return (
    <section className="ana-bolum ana-gir" style={{ animationDelay: "340ms" }} aria-labelledby="son-hareketler">
      <div className="flex items-center justify-between">
        <h2 id="son-hareketler" className="ana-baslik">Son hareketler</h2>
        <Link href={sekme === "gider" ? "/giderler" : "/yukler"} className="ana-link">
          Tümü →
        </Link>
      </div>
      <div className="mt-2.5 flex gap-1.5" role="tablist" aria-label="Hareket türü">
        {(
          [
            ["sefer", "Seferler"],
            ["gider", "Giderler"],
          ] as const
        ).map(([kod, ad]) => {
          const aktif = sekme === kod;
          return (
            <button
              key={kod}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => setSekme(aktif ? null : kod)}
              className={`relative rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors duration-200 ${aktif ? "text-white" : "text-[var(--a-ikincil)]"}`}
            >
              {aktif && (
                <m.span
                  layoutId="hareket-sekme"
                  className="absolute inset-0 rounded-full bg-[var(--a-indigo)] shadow-[0_6px_16px_-6px_rgba(79,70,229,0.7)]"
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                />
              )}
              {!aktif && <span className="absolute inset-0 rounded-full bg-[#eef0f8]" />}
              <span className="relative">{ad}</span>
            </button>
          );
        })}
      </div>

      {liste.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-[var(--a-ikincil)]">Henüz kayıt yok. İlk seferini ekle.</p>
      ) : (
        <ul className="mt-1.5">
          {liste.map((h) => {
            const ik = ikonu(h);
            const d = h.durum ? DURUM[h.durum] ?? DURUM.BEKLIYOR : null;
            return (
              <li key={h.anahtar} className="border-b border-[var(--a-cizgi)] last:border-0">
                <Link href={h.href} className="flex items-center gap-2.5 py-2">
                  <span className={`ana-mini-ikon ${ik.ton}`} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {ik.yol}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{h.baslik}</span>
                    <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">
                      {h.tarih} • {h.alt}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[14.5px] font-bold tabular-nums ${h.gelir ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                    {h.gelir ? "+" : "−"}
                    {tl(h.tutar)}
                  </span>
                  <span className={`w-[3.6rem] shrink-0 text-right text-[11.5px] font-semibold ${d?.renk ?? ""}`}>{d?.ad ?? ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
