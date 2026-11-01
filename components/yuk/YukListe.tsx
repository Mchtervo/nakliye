"use client";

import { m } from "motion/react";
import { useState } from "react";
import YukKart, { type IlanKartVeri } from "@/components/yuk/YukKart";

const TAKIP_SUZGEC = [
  { kod: "HEPSI", ad: "Hepsi", durumlar: null },
  { kod: "ILGILENIYOR", ad: "Takipte", durumlar: ["ILGILENIYOR"] },
  { kod: "ILETISIME_GECILDI", ad: "Arandı", durumlar: ["ILETISIME_GECILDI"] },
  { kod: "PAZARLIKTA", ad: "Pazarlık", durumlar: ["PAZARLIKTA"] },
  { kod: "CEVAP_YOK", ad: "Cevap yok", durumlar: ["CEVAP_YOK"] },
  { kod: "ALINDI", ad: "Alındı", durumlar: ["ALINDI"] },
] as const;

/**
 * İlan listesi. Takip görünümünde üstte durum süzgeci (sayılarıyla);
 * süzme tarayıcıda, veri ve sunucu filtreleri değişmez.
 */
export default function YukListe({ ilanlar, gorunum }: { ilanlar: IlanKartVeri[]; gorunum: "liste" | "takip" | "donus" }) {
  const [suzgec, setSuzgec] = useState<string>("HEPSI");
  const secenekler =
    gorunum === "takip"
      ? TAKIP_SUZGEC.map((s) => ({ ...s, sayi: s.durumlar ? ilanlar.filter((i) => (s.durumlar as readonly string[]).includes(i.durum)).length : ilanlar.length })).filter(
          (s) => s.kod === "HEPSI" || s.sayi > 0
        )
      : [];
  const aktif = secenekler.find((s) => s.kod === suzgec);
  const liste = aktif?.durumlar ? ilanlar.filter((i) => (aktif.durumlar as readonly string[]).includes(i.durum)) : ilanlar;

  return (
    <div>
      {secenekler.length > 2 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Takip durumu">
          {secenekler.map((s) => {
            const secili = s.kod === suzgec;
            return (
              <button
                key={s.kod}
                type="button"
                role="tab"
                aria-selected={secili}
                onClick={() => setSuzgec(s.kod)}
                className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors duration-200 ${secili ? "text-white" : "text-[#3b4262]"}`}
              >
                {secili ? (
                  <m.span layoutId="takip-suzgec" className="absolute inset-0 rounded-full bg-[var(--a-indigo)] shadow-[0_8px_18px_-8px_rgba(79,70,229,0.8)]" transition={{ type: "spring", stiffness: 520, damping: 42 }} />
                ) : (
                  <span className="absolute inset-0 rounded-full border border-[#e3e6f3] bg-white" />
                )}
                <span className="relative">
                  {s.ad}
                  <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${secili ? "bg-white/25" : "bg-[#eef0f8]"}`}>{s.sayi}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-3 xl:grid xl:grid-cols-2 xl:items-start xl:gap-3 xl:space-y-0">
        {liste.map((ilan) => (
          <YukKart key={ilan.id} ilan={ilan} gorunum={gorunum} />
        ))}
      </div>
    </div>
  );
}
