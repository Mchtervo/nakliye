"use client";

import { AnimatePresence, m } from "motion/react";
import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { yukOdemeEkle, type FormSonuc } from "@/app/actions";
import { anaYazi } from "@/components/ana/yazi";
import { tlKurusaCevir, tlGirisBicimle, tlYaz, tlYazKisa } from "@/lib/para";

function bugun(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const bosAbone = () => () => {};

export type TahsilatRota = { nereden: string; nereye: string; firma: string; tarih: string };

/**
 * Anlaşılan tutardan düşerek ödeme girişi.
 * Kullanıcı "ne kadar ödedi" yazar → kalan canlı hesaplanır.
 * tema="acik": tam ekran "Tahsilat ekle" sayfası (alttan açılır); koyu: satır içi form.
 */
export default function OdemeGirForm({
  yukId,
  anlasilanKurus,
  odenenKurus,
  tema = "koyu",
  rota,
  dugmeSinif,
}: {
  yukId: number;
  anlasilanKurus: number;
  odenenKurus: number;
  tema?: "koyu" | "acik";
  rota?: TahsilatRota;
  dugmeSinif?: string;
}) {
  const kalanBaslangic = Math.max(0, anlasilanKurus - odenenKurus);
  const [acik, setAcik] = useState(false);
  const [girilen, setGirilen] = useState("");
  const [kaydedildi, setKaydedildi] = useState(false);

  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    async (onceki, fd) => {
      const sonuc = await yukOdemeEkle(onceki, fd);
      if (!sonuc?.hata) {
        if (tema === "acik") {
          // Kısa "kaydedildi" onayı, sonra kapanır
          setKaydedildi(true);
          window.setTimeout(() => {
            setKaydedildi(false);
            setAcik(false);
            setGirilen("");
          }, 1100);
        } else {
          setAcik(false);
          setGirilen("");
        }
      }
      return sonuc;
    },
    null
  );

  const hazir = useSyncExternalStore(bosAbone, () => true, () => false);
  useEffect(() => {
    if (tema !== "acik" || !acik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tus = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    window.addEventListener("keydown", tus);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", tus);
    };
  }, [tema, acik]);

  const girilenKurus = tlKurusaCevir(girilen);
  const onizleme = useMemo(() => {
    if (girilenKurus === null || girilenKurus <= 0) return null;
    if (girilenKurus > kalanBaslangic) {
      return { hata: true, kalan: kalanBaslangic - girilenKurus };
    }
    return { hata: false, kalan: kalanBaslangic - girilenKurus };
  }, [girilenKurus, kalanBaslangic]);

  if (kalanBaslangic <= 0) return null;

  if (tema === "acik") {
    const kalanSonra = onizleme ? onizleme.kalan : kalanBaslangic;
    return (
      <>
        <button type="button" onClick={() => setAcik(true)} className={dugmeSinif || "ana-ana-dugme"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 17h3" />
          </svg>
          Ödeme gir
        </button>
        {hazir &&
          createPortal(
            <AnimatePresence>
              {acik && (
                <m.div
                  key="tahsilat"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Tahsilat ekle"
                  className={`yuk-detay ana ${anaYazi.variable}`}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 40, mass: 0.9 }}
                >
                  <div className="yuk-detay-ust !pb-12">
                    <div className="ana-ust-zemin" aria-hidden />
                    <div className="relative mx-auto w-full max-w-[40rem] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setAcik(false)}
                          aria-label="Geri"
                          className="ana-zil flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                            <path d="M19 12H5M11 6l-6 6 6 6" />
                          </svg>
                        </button>
                        <div className="leading-tight">
                          <p className="text-[12.5px] font-semibold text-[#9fb0ff]">Nakliye Defteri</p>
                          <p className="text-[1.6rem] font-extrabold tracking-[-0.03em] text-white">Tahsilat ekle</p>
                        </div>
                      </div>
                      <p className="mt-0.5 text-[14px] text-[#b8c1f5]">Bu sefer için tahsilat kaydı oluştur</p>
                      {rota && (
                        <div className="mt-4 flex items-center gap-3 rounded-[1.2rem] border border-white/15 bg-white/10 px-3 py-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                              <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V16H2z" />
                              <path d="M14 10h3.6a1.5 1.5 0 0 1 1.2.6l2.2 2.9V16h-7z" />
                              <circle cx="6" cy="17" r="2" />
                              <circle cx="17.5" cy="17" r="2" />
                            </svg>
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[17px] font-extrabold text-white">
                              {rota.nereden} → {rota.nereye}
                            </span>
                            <span className="block truncate text-[12.5px] text-[#c7d0fb]">
                              {rota.firma} • {rota.tarih}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="yuk-detay-govde">
                    <form action={aksiyon} className="mx-auto w-full max-w-[40rem] space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3">
                      <span className="sf-tutamac" aria-hidden />
                      <input type="hidden" name="yukId" value={yukId} />
                      <div className="grid grid-cols-3 rounded-[1.2rem] border border-[var(--a-cizgi)] text-center">
                        {(
                          [
                            ["Anlaşılan", tlYazKisa(anlasilanKurus), "text-[var(--a-murekkep)]"],
                            ["Ödenen", tlYazKisa(odenenKurus), "text-[var(--a-murekkep)]"],
                            ["Kalan", tlYazKisa(kalanBaslangic), "text-[#ea580c]"],
                          ] as const
                        ).map(([ad, deger, renk], i) => (
                          <div key={ad} className={`px-1 py-3 ${i > 0 ? "border-l border-[var(--a-cizgi)]" : ""}`}>
                            <p className="text-[12px] text-[var(--a-ikincil)]">{ad}</p>
                            <p className={`mt-0.5 text-[1rem] font-extrabold tabular-nums ${renk}`}>{deger}</p>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label htmlFor={`odeme-${yukId}`} className="sf-etiket">
                          Tahsilat tutarı
                        </label>
                        <div className="sf-alan !min-h-[3.6rem]">
                          <span className="sf-alan-ikon !bg-[#4f46e5] !text-white" aria-hidden>
                            ₺
                          </span>
                          <input
                            id={`odeme-${yukId}`}
                            name="tutar"
                            type="text"
                            inputMode="decimal"
                            required
                            placeholder={`En fazla ${tlYazKisa(kalanBaslangic)}`}
                            value={girilen}
                            onChange={(e) => setGirilen(tlGirisBicimle(e.target.value))}
                            className="sf-girdi !text-[1.45rem] !font-extrabold"
                          />
                          <button
                            type="button"
                            onClick={() => setGirilen(tlGirisBicimle(String(kalanBaslangic / 100).replace(".", ",")))}
                            className="ana-hap !min-h-8 shrink-0 !px-3 !text-[12px]"
                          >
                            Tamamı
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor={`odeme-tarih-${yukId}`} className="sf-etiket">
                          Tarih
                        </label>
                        <div className="sf-alan">
                          <input id={`odeme-tarih-${yukId}`} name="tarih" type="date" required defaultValue={bugun()} className="sf-girdi" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor={`odeme-not-${yukId}`} className="sf-etiket">
                          Açıklama <span className="font-medium text-[var(--a-ikincil)]">(isteğe bağlı)</span>
                        </label>
                        <div className="sf-alan">
                          <input id={`odeme-not-${yukId}`} name="not" type="text" placeholder="Örnek: peşinat, ara ödeme…" className="sf-girdi" />
                        </div>
                      </div>

                      <AnimatePresence initial={false} mode="wait">
                        {onizleme?.hata ? (
                          <m.p
                            key="hata"
                            role="alert"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="rounded-[1.2rem] bg-[#fee2e2] px-4 py-3 text-[13.5px] font-semibold text-[#b91c1c]"
                          >
                            Kalan alacak {tlYazKisa(kalanBaslangic)}. Daha fazla giremezsin.
                          </m.p>
                        ) : (
                          <m.div
                            key={kalanSonra === 0 ? "kapanir" : "kalan"}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className={`flex items-center gap-3 rounded-[1.2rem] px-4 py-3 ${kalanSonra === 0 ? "bg-[#dcfce7]" : "bg-[#fff4e6]"}`}
                          >
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px] font-bold text-white ${kalanSonra === 0 ? "bg-[#16a34a]" : "bg-[#f97316]"}`}
                              aria-hidden
                            >
                              {kalanSonra === 0 ? "✓" : "₺"}
                            </span>
                            <span>
                              <span className="block text-[13px] text-[#3b4262]">{onizleme ? "Bu ödemeden sonra kalan" : "Şu an kalan"}</span>
                              <span className={`block text-[1.45rem] font-extrabold tabular-nums ${kalanSonra === 0 ? "text-[#15803d]" : "text-[#ea580c]"}`}>
                                {tlYazKisa(kalanSonra)}
                                {onizleme && kalanSonra === 0 && <span className="ml-2 text-[13px] font-bold">tamamı kapanır</span>}
                              </span>
                            </span>
                          </m.div>
                        )}
                      </AnimatePresence>

                      {durum?.hata && (
                        <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13px] font-semibold text-[#b91c1c]">
                          {durum.hata}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={bekliyor || kaydedildi || Boolean(onizleme?.hata)}
                        className="ana-ana-dugme w-full !min-h-12 !text-[15px] disabled:opacity-60"
                      >
                        {kaydedildi ? "✓ Tahsilat kaydedildi" : bekliyor ? "Kaydediliyor…" : "Tahsilatı kaydet"}
                      </button>
                      <p className="text-center text-[12px] text-[var(--a-ikincil)]">Kayıt işlemidir; para transferi yapmaz.</p>
                    </form>
                  </div>
                </m.div>
              )}
            </AnimatePresence>,
            document.body
          )}
      </>
    );
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="rounded-lg border border-amber/40 px-2.5 py-1.5 text-sm font-semibold text-amber transition-colors hover:bg-amber/10"
      >
        Ödeme Gir
      </button>
    );
  }

  return (
    <form
      action={aksiyon}
      className="w-full space-y-3 rounded-xl border border-amber/30 bg-asphalt/50 p-3"
    >
      <input type="hidden" name="yukId" value={yukId} />

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="font-bold uppercase tracking-wider text-fog">Anlaşılan</div>
          <div className="mt-0.5 font-display text-sm font-bold text-paper">
            {tlYaz(anlasilanKurus)}
          </div>
        </div>
        <div>
          <div className="font-bold uppercase tracking-wider text-fog">Ödenen</div>
          <div className="mt-0.5 font-display text-sm font-bold text-ok">
            {tlYaz(odenenKurus)}
          </div>
        </div>
        <div>
          <div className="font-bold uppercase tracking-wider text-fog">Kalan</div>
          <div className="mt-0.5 font-display text-sm font-bold text-amber">
            {tlYaz(kalanBaslangic)}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`odeme-${yukId}`} className="etiket !text-fog">
          Ne kadar ödedi? (TL)
        </label>
        <input
          id={`odeme-${yukId}`}
          name="tutar"
          type="text"
          inputMode="decimal"
          required
          placeholder={`En fazla ${tlYaz(kalanBaslangic)}`}
          value={girilen}
          onChange={(e) => setGirilen(tlGirisBicimle(e.target.value))}
          className="alan !py-2.5 font-display text-lg font-bold"
        />
      </div>

      {onizleme && !onizleme.hata && (
        <div className="rounded-lg bg-ok/10 px-3 py-2 text-sm font-semibold text-ok">
          Bu ödemeden sonra kalan: {tlYaz(onizleme.kalan)}
          {onizleme.kalan === 0 ? " — tamamı kapanır" : ""}
        </div>
      )}
      {onizleme?.hata && (
        <div className="rounded-lg bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          Kalan alacak {tlYaz(kalanBaslangic)}. Daha fazla giremezsin.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="etiket !text-fog">Tarih</label>
          <input
            name="tarih"
            type="date"
            required
            defaultValue={bugun()}
            className="alan !py-2 text-sm"
          />
        </div>
        <div>
          <label className="etiket !text-fog">Not</label>
          <input
            name="not"
            type="text"
            placeholder="İsteğe bağlı"
            className="alan !py-2 text-sm"
          />
        </div>
      </div>

      {durum?.hata && (
        <p className="text-xs font-semibold text-ember">{durum.hata}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={bekliyor} className="btn btn-amber !py-2 text-sm">
          {bekliyor ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAcik(false);
            setGirilen("");
          }}
          className="btn btn-ghost !py-2 text-sm"
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
