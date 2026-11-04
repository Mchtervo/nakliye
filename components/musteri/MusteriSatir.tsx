"use client";

import { AnimatePresence, m } from "motion/react";
import { useActionState, useState, useTransition } from "react";
import { musteriIsaretle, musteriNotKaydet } from "@/app/musteri-actions";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";

export type MusteriSatirVeri = {
  telefon: string;
  telefonYazi: string;
  ad: string;
  sinif: "YUK_SAHIBI" | "KOMISYONCU" | "KARISIK";
  guzergah: string | null;
  /** "Çıkış: Ankara %75 · İstanbul %25" */
  sehirYazi: string | null;
  /** "Bugün 3 · 7 günde 12 · toplam 48" */
  sayilar: string;
  ozet: string;
  isaretli: boolean;
  sonNot: string | null;
};

const SINIF = {
  YUK_SAHIBI: { ad: "Yük sahibi", sinif: "bg-[#eef0ff] text-[#3730a3]" },
  KOMISYONCU: { ad: "Komisyoncu", sinif: "bg-[#ffedd5] text-[#c2410c]" },
  KARISIK: { ad: "Karışık", sinif: "bg-[#f1f5f9] text-[#475569]" },
} as const;

/** Müşteri kartı: ara, WhatsApp, kişisel not ve "müşterim" işareti (yalnız kendi hesabında). */
export default function MusteriSatir({ m: v, idx }: { m: MusteriSatirVeri; idx: number }) {
  const [notAcik, setNotAcik] = useState(false);
  const [isaretli, setIsaretli] = useState(v.isaretli);
  const [, baslat] = useTransition();
  const [durum, aksiyon, bekliyor] = useActionState(musteriNotKaydet, null);
  const s = SINIF[v.sinif];

  return (
    <li className="rp-kart space-y-2.5 px-4 py-3.5">
      <div className="flex items-start gap-3">
        <FirmaAvatar id={idx + 1} ad={v.ad} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-extrabold">{v.ad}</span>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${s.sinif}`}>{s.ad} · tahmini</span>
          <span className="mt-1 block text-[13.5px] font-extrabold text-[#3730a3]">{v.sayilar}</span>
          {v.sehirYazi && <span className="block text-[13px] font-semibold text-[#3b4262]">{v.sehirYazi}</span>}
          {v.guzergah && <span className="block truncate text-[13px] font-semibold text-[#3b4262]">En sık: {v.guzergah}</span>}
          <span className="block text-[12px] text-[var(--a-ikincil)]">{v.ozet}</span>
          <span className="mt-0.5 block text-[13px] font-semibold tabular-nums">{v.telefonYazi}</span>
        </span>
        <button
          type="button"
          aria-pressed={isaretli}
          aria-label={isaretli ? "Müşterim işaretini kaldır" : "Müşterim olarak işaretle"}
          onClick={() => {
            setIsaretli((x) => !x);
            baslat(async () => {
              const r = await musteriIsaretle(v.telefon);
              if (!r.ok) setIsaretli((x) => !x);
            });
          }}
          className={`ana-yuvarlak ${isaretli ? "!bg-[#4f46e5] text-white" : "text-[#6b7290]"}`}
        >
          <svg viewBox="0 0 24 24" fill={isaretli ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={`tel:+90${v.telefon}`} className="kk-cerceve-dugme !min-h-11 !text-[14px]">
          Ara
        </a>
        <a href={`https://wa.me/90${v.telefon}`} target="_blank" rel="noopener noreferrer" className="kk-cerceve-dugme !min-h-11 !text-[14px] !text-[#16a34a]">
          WhatsApp
        </a>
      </div>
      {v.sonNot && !notAcik && (
        <p className="rounded-xl bg-[#f6f7fb] px-3 py-2 text-[13px]">
          <span className="block text-[11px] font-bold text-[var(--a-ikincil)]">Kendi notun</span>
          {v.sonNot}
        </p>
      )}
      <button type="button" onClick={() => setNotAcik((x) => !x)} className="relative text-[13px] font-bold text-[#3730a3] after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']">
        {notAcik ? "Vazgeç" : "+ Not ekle"}
      </button>
      <AnimatePresence initial={false}>
        {notAcik && (
          <m.form
            action={aksiyon}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden"
          >
            <input type="hidden" name="telefon" value={v.telefon} />
            <textarea name="metin" required maxLength={500} rows={2} className="ana-alan !h-auto py-2" placeholder="Örn. ödemeleri düzenli, Gebze hattı" />
            <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-11">
              {bekliyor ? "Kaydediliyor…" : "Notu kaydet"}
            </button>
            {durum?.hata && <p className="text-[12.5px] font-semibold text-[#dc2626]">{durum.hata}</p>}
            {durum?.ok && <p className="text-[12.5px] font-semibold text-[#16a34a]">Not kaydedildi.</p>}
          </m.form>
        )}
      </AnimatePresence>
    </li>
  );
}
