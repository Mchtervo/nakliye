"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Sayfaya giden alanlar: telefon / ad yok (bkz. lib/vitrin.ts). */
export type VitrinKartVeri = {
  cikis: string;
  varis: string;
  arac: string | null;
  tonaj: string | null;
  fiyat: string | null;
  /** Kaç dakika önce */
  dk: number;
};

function sureYazi(dk: number): string {
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  const kalan = dk % 60;
  return kalan ? `${sa} sa ${kalan} dk önce` : `${sa} sa önce`;
}

/** "Detay gör" penceresi: iletişim bilgisi üyelere açık, giriş / kayıt seçenekleri. */
function GirisPenceresi({ kapat }: { kapat: () => void }) {
  useEffect(() => {
    const tus = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    document.addEventListener("keydown", tus);
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tus);
      document.body.style.overflow = onceki;
    };
  }, [kapat]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1138]/60 p-5 backdrop-blur-[2px]" onClick={kapat}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vitrin-baslik"
        className="w-full max-w-sm rounded-[1.6rem] bg-white p-6 text-center shadow-[0_24px_60px_rgba(30,27,107,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef0ff] text-[#4f46e5]" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          </svg>
        </span>
        <h2 id="vitrin-baslik" className="mt-4 text-[1.2rem] font-extrabold text-[#1e1b6b]">
          Detay için giriş yap
        </h2>
        <p className="mt-1.5 text-[14px] leading-snug text-[#3b4262]">
          Yük verenin telefonu ve WhatsApp&apos;ı yalnızca üyelere açık. Giriş yap ya da kaydol, ilanı hemen ara.
        </p>
        <div className="mt-5 space-y-2.5">
          <Link href="/giris?next=%2Fai%2Fyukler" className="ana-ana-dugme block w-full !min-h-12 !text-[15px] text-center leading-[3rem]">
            Giriş yap
          </Link>
          <Link href="/kayit" className="sf-ikincil-dugme block w-full !min-h-12 text-center leading-[3rem]">
            Kaydol
          </Link>
          <button type="button" onClick={kapat} className="pt-1 text-[13px] font-semibold text-[var(--a-ikincil)]">
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VitrinListe({ ilanlar, canliSayi }: { ilanlar: VitrinKartVeri[]; canliSayi: number }) {
  const [acik, setAcik] = useState(false);

  return (
    <>
      {ilanlar.length === 0 ? (
        <p className="rp-bos">Şu an gösterilecek ilan yok. Üyeler anlık ilanları görür.</p>
      ) : (
        <ul className="space-y-3">
          {ilanlar.map((i) => (
            <li key={`${i.cikis}-${i.varis}`} className="rp-kart space-y-2.5 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[17px] font-extrabold leading-snug text-[#1e1b6b]">
                  {i.cikis} <span className="text-[#6d74ff]">→</span> {i.varis}
                </p>
                <span className="shrink-0 pt-0.5 text-[12px] font-semibold text-[var(--a-ikincil)]">{sureYazi(i.dk)}</span>
              </div>
              {(i.arac || i.tonaj) && (
                <div className="flex flex-wrap gap-1.5">
                  {[i.arac, i.tonaj].filter(Boolean).map((c) => (
                    <span key={c} className="rounded-full bg-[#eef0ff] px-2.5 py-0.5 text-[12px] font-bold text-[#3730a3]">
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {i.fiyat && <p className="text-[15px] font-extrabold tabular-nums text-[#15803d]">{i.fiyat}</p>}
              <button type="button" onClick={() => setAcik(true)} className="kk-cerceve-dugme !min-h-11 w-full !text-[14px]">
                Detay gör
              </button>
            </li>
          ))}

          {/* Daha fazlası var hissi: içeriksiz, bulanık iskelet kartlar (gerçek veri değil) */}
          {[0, 1].map((n) => (
            <li key={n} aria-hidden className="rp-kart pointer-events-none select-none space-y-2.5 px-4 py-3.5 opacity-70 blur-[5px]">
              <div className="h-5 w-3/4 rounded-full bg-[#dfe2f5]" />
              <div className="h-4 w-1/3 rounded-full bg-[#eef0ff]" />
              <div className="h-11 w-full rounded-full bg-[#eef0ff]" />
            </li>
          ))}
        </ul>
      )}

      <div className="rp-kart space-y-3 px-5 py-5 text-center">
        <p className="text-[1.05rem] font-extrabold text-[#1e1b6b]">
          {canliSayi > 0 ? `Şu an listede ${canliSayi} canlı ilan var` : "Canlı ilanlar üyelere açık"}
        </p>
        <p className="text-[13.5px] leading-snug text-[#3b4262]">
          Üyeler yeni ilanı anında görür, telefonla ya da WhatsApp&apos;la hemen arar. Burada gördüklerin 30 dakikadan eski ilanlardan bir seçki.
        </p>
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Link href="/kayit" className="ana-ana-dugme block !min-h-12 text-center leading-[3rem]">
            Kaydol
          </Link>
          <Link href="/giris?next=%2Fai%2Fyukler" className="sf-ikincil-dugme block !min-h-12 text-center leading-[3rem]">
            Giriş yap
          </Link>
        </div>
      </div>

      {acik && <GirisPenceresi kapat={() => setAcik(false)} />}
    </>
  );
}
