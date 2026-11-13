"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import SoforAvatar from "@/components/arac/SoforAvatar";
import { useSayan } from "@/components/hareket/SayanSayi";
import { tirHesabi, type TirSatiri } from "@/lib/tirHesap";

const YAY = [0.32, 0.72, 0, 1] as const;
const tl = (kurus: number) => `${kurus < 0 ? "−" : ""}₺${Math.abs(Math.round(kurus / 100)).toLocaleString("tr-TR")}`;

function Sayan({ deger, className = "" }: { deger: number; className?: string }) {
  const d = useSayan(deger);
  return <span className={`tabular-nums ${className}`}>{tl(d)}</span>;
}

function Cubuk({ oran, renk, gecikme }: { oran: number; renk: string; gecikme: number }) {
  return (
    <span className="block h-[7px] w-full overflow-hidden rounded-full bg-[#eceef6]">
      <m.span
        className={`block h-full rounded-full ${renk}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, oran)) * 100}%` }}
        transition={{ duration: 0.6, delay: gecikme, ease: YAY }}
      />
    </span>
  );
}

/** KDV ve kâr dökümü (açılır). */
function Dokum({ s }: { s: TirSatiri }) {
  const { kar, kdvOdenecek } = tirHesabi(s);
  const satirlar: [string, number, string?][] = [
    ["Gelir (KDV hariç)", s.gelir, "text-[#16a34a]"],
    ["Gider (KDV hariç)", -s.gider, "text-[#ef4444]"],
    ["Kâr", kar, kar < 0 ? "text-[#dc2626]" : "text-[#15803d]"],
    ["Seferlerin KDV'si (tahsil edilen)", s.gelirKdv],
    ["Giderlerin KDV'si (düşülen)", -s.giderKdv],
    [kdvOdenecek >= 0 ? "Ödenecek KDV" : "Devreden KDV (sonraki aya)", Math.abs(kdvOdenecek), kdvOdenecek > 0 ? "text-[#c2410c]" : "text-[#4f46e5]"],
  ];
  return (
    <m.dl
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: YAY }}
      className="overflow-hidden"
    >
      <div className="mt-2 space-y-1 rounded-2xl bg-[#f6f7fc] px-3 py-2.5">
        {satirlar.map(([ad, tutar, renk], i) => (
          <div key={ad} className={`flex items-baseline justify-between gap-3 text-[13px] ${i === 2 || i === 5 ? "border-t border-[var(--a-cizgi)] pt-1.5 font-extrabold" : ""}`}>
            <dt className="text-[var(--a-ikincil)]">{ad}</dt>
            <dd className={`font-bold tabular-nums ${renk ?? ""}`}>{tl(tutar)}</dd>
          </div>
        ))}
        {s.gelir > 0 && (
          <p className="pt-1 text-[11.5px] text-[var(--a-ikincil)]">
            Kâr oranı %{Math.round((kar / s.gelir) * 100)} · sefer başı ortalama {tl(s.sefer ? s.gelir / s.sefer : 0)}
          </p>
        )}
      </div>
    </m.dl>
  );
}

function TirKarti({ s, olcek, sira }: { s: TirSatiri; olcek: number; sira: number }) {
  const [acik, setAcik] = useState(false);
  const { kar, kdvOdenecek } = tirHesabi(s);
  const gecikme = 0.08 * sira;
  return (
    <m.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: gecikme, ease: YAY }}
      className="rounded-[1.3rem] bg-white p-3.5 shadow-[var(--a-golge)]"
    >
      <button type="button" onClick={() => setAcik((a) => !a)} aria-expanded={acik} className="block w-full text-left">
        <div className="flex items-center gap-3">
          {s.soforFoto || s.sofor ? (
            <SoforAvatar foto={s.soforFoto} ad={s.sofor} boyut={42} />
          ) : (
            <span className="ana-mini-ikon ana-ton-indigo shrink-0" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" />
                <circle cx="6.5" cy="17" r="1.8" />
                <circle cx="17" cy="17" r="1.8" />
              </svg>
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold">{s.sofor || s.etiket}</span>
            <span className="block truncate text-[12px] text-[var(--a-ikincil)]">
              {[s.sofor ? s.etiket : null, `${s.sefer} sefer`].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="text-right">
            <Sayan deger={kar} className={`block text-[16px] font-extrabold ${kar < 0 ? "text-[#dc2626]" : "text-[#15803d]"}`} />
            <span className="block text-[11px] text-[var(--a-ikincil)]">kâr</span>
          </span>
          <m.span animate={{ rotate: acik ? 90 : 0 }} transition={{ duration: 0.2 }} className="text-[18px] leading-none text-[var(--a-ikincil)]" aria-hidden>
            ›
          </m.span>
        </div>
        <div className="mt-3 grid grid-cols-[3.4rem_1fr_auto] items-center gap-x-2 gap-y-1.5 text-[12.5px]">
          <span className="text-[var(--a-ikincil)]">Gelir</span>
          <Cubuk oran={s.gelir / olcek} renk="bg-[#22c55e]" gecikme={gecikme + 0.1} />
          <Sayan deger={s.gelir} className="text-right font-bold" />
          <span className="text-[var(--a-ikincil)]">Gider</span>
          <Cubuk oran={s.gider / olcek} renk="bg-[#f87171]" gecikme={gecikme + 0.16} />
          <Sayan deger={s.gider} className="text-right font-bold" />
        </div>
        {kdvOdenecek !== 0 && (
          <p className="mt-2 text-[12px] font-semibold text-[var(--a-ikincil)]">
            {kdvOdenecek > 0 ? `Ödenecek KDV ${tl(kdvOdenecek)}` : `Devreden KDV ${tl(-kdvOdenecek)}`} · dokun, ayrıntıyı gör
          </p>
        )}
      </button>
      <AnimatePresence initial={false}>{acik && <Dokum key="d" s={s} />}</AnimatePresence>
    </m.li>
  );
}

/** Tüm tırların toplamı: lacivert kart, büyük kâr, KDV özeti. */
function ToplamKart({ s }: { s: TirSatiri }) {
  const { kar, kdvOdenecek } = tirHesabi(s);
  const [acik, setAcik] = useState(false);
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: YAY }}
      className="rounded-[1.5rem] bg-gradient-to-br from-[#1e2a78] to-[#3b3fc4] p-4 text-white shadow-[0_14px_30px_-14px_rgba(40,48,160,0.6)]"
    >
      <button type="button" onClick={() => setAcik((a) => !a)} aria-expanded={acik} className="block w-full text-left">
        <p className="text-[12.5px] font-semibold text-[#c7cffd]">Tüm tırlar · {s.sefer} sefer</p>
        <Sayan deger={kar} className="mt-0.5 block text-[1.9rem] font-extrabold leading-tight tracking-[-0.02em]" />
        <p className="text-[12px] text-[#c7cffd]">bu ayki kâr (KDV hariç)</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          {(
            [
              ["Gelir", s.gelir],
              ["Gider", s.gider],
              [kdvOdenecek >= 0 ? "Ödenecek KDV" : "Devreden KDV", Math.abs(kdvOdenecek)],
            ] as const
          ).map(([ad, tutar]) => (
            <span key={ad} className="rounded-xl bg-white/10 px-2.5 py-2">
              <span className="block text-[#c7cffd]">{ad}</span>
              <Sayan deger={tutar} className="block text-[14px] font-extrabold" />
            </span>
          ))}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {acik && (
          <m.dl
            key="t"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: YAY }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1 border-t border-white/15 pt-2.5 text-[13px]">
              {(
                [
                  ["Seferlerin KDV'si (tahsil edilen)", s.gelirKdv],
                  ["Giderlerin KDV'si (düşülen)", -s.giderKdv],
                  [kdvOdenecek >= 0 ? "Ödenecek KDV" : "Devreden KDV", Math.abs(kdvOdenecek)],
                  ["KDV dahil gelir", s.gelir + s.gelirKdv],
                ] as const
              ).map(([ad, tutar]) => (
                <div key={ad} className="flex justify-between gap-3">
                  <dt className="text-[#c7cffd]">{ad}</dt>
                  <dd className="font-bold tabular-nums">{tl(tutar)}</dd>
                </div>
              ))}
            </div>
          </m.dl>
        )}
      </AnimatePresence>
    </m.div>
  );
}

export default function TirKartlari({ tirlar, toplam }: { tirlar: TirSatiri[]; toplam: TirSatiri | null }) {
  const olcek = Math.max(1, ...tirlar.flatMap((s) => [s.gelir, s.gider]));
  return (
    <section className="ana-bolum ana-gir" style={{ animationDelay: "320ms" }} aria-labelledby="tirlar-bu-ay">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tirlar-bu-ay" className="ana-baslik">
          Tırlar bu ay
        </h2>
        <Link href="/raporlar" className="text-[12.5px] font-bold text-[var(--a-indigo)]">
          Geçmiş aylar ›
        </Link>
      </div>
      <div className="mt-3 space-y-2.5">
        {toplam && <ToplamKart s={toplam} />}
        <ul className="space-y-2.5">
          {tirlar.map((s, i) => (
            <TirKarti key={s.id} s={s} olcek={olcek} sira={i} />
          ))}
        </ul>
      </div>
      <p className="mt-2 px-1 text-[11.5px] text-[var(--a-ikincil)]">
        Kâr KDV hariçtir. KDV: seferlerden tahsil edilen − giderlerde ödenen = devlete ödenecek. Tır seçilmeden girilen eski kayıtlar ilk tıra yazılır.
      </p>
    </section>
  );
}
