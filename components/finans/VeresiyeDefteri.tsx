"use client";

import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { veresiyeOdemeYap } from "@/app/actions";
import BildirimZili from "@/components/BildirimZili";
import AltPanel from "@/components/ana/AltPanel";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import KategoriIkon from "@/components/gider/KategoriIkon";
import { tlGirisBicimle, tlKurusaCevir, tlYazKisa } from "@/lib/para";

export type VeresiyeGorunum = {
  yer: string;
  /** İkon için en çok alınan kategori (YAKIT, BAKIM…) */
  kategori?: string;
  alinan: number;
  odenen: number;
  kalan: number;
  hareketler: { anahtar: string; href?: string; tarihIso: string; ad: string; tutar: number; odeme: boolean }[];
};

const tarihBicim = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const yay = { type: "spring", stiffness: 420, damping: 38 } as const;

/** Kuruşu giriş kutusu biçimine çevirir (125050 → "1.250,50"). */
function girisYaz(kurus: number) {
  return tlGirisBicimle(String(kurus / 100).replace(".", ","));
}

function OdemeIcerik({ yer, ornek, kapat, kilitle }: { yer: VeresiyeGorunum; ornek: boolean; kapat: () => void; kilitle: (k: boolean) => void }) {
  const router = useRouter();
  const [tutar, setTutar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bitti, setBitti] = useState(false);
  const [bekliyor, baslat] = useTransition();

  const girilen = tlKurusaCevir(tutar);
  const fazla = girilen !== null && girilen > yer.kalan;
  const sonra = girilen !== null && girilen > 0 && !fazla ? yer.kalan - girilen : yer.kalan;
  const secili = girilen === yer.kalan ? "tamami" : girilen === Math.round(yer.kalan / 2) ? "yarisi" : null;

  useEffect(() => kilitle(bekliyor), [bekliyor, kilitle]);

  function ode() {
    setHata(null);
    if (girilen === null || girilen <= 0) return setHata("Ödeme tutarını yaz (örn. 5.000).");
    if (fazla) return setHata(`Kalan borç ${tlYazKisa(yer.kalan)}. Daha fazla yazamazsın.`);
    baslat(async () => {
      // Önizlemede gerçek kayıt yok; yalnızca bekleme/başarı akışı gösterilir.
      const r = ornek ? await new Promise<{ hata: string | null }>((ok) => setTimeout(() => ok({ hata: null }), 700)) : await veresiyeOdemeYap(yer.yer, tutar);
      if (r.hata) return setHata(r.hata);
      setBitti(true);
      if (!ornek) router.refresh();
      setTimeout(kapat, 1200);
    });
  }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {bitti ? (
          <m.div
            key="bitti"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={yay}
            className="flex flex-col items-center gap-2 py-10"
            role="status"
          >
            <svg viewBox="0 0 52 52" className="h-16 w-16" aria-hidden>
              <circle cx="26" cy="26" r="24" fill="#dcfce7" />
              <path className="onay-cizgi" d="M15 27l7 7 15-15" fill="none" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[17px] font-extrabold">Ödeme yazıldı</p>
            <p className="text-[13.5px] text-[var(--a-ikincil)]">
              {yer.yer} kalan borç: <b className="text-[var(--a-murekkep)]">{tlYazKisa(sonra)}</b>
            </p>
          </m.div>
        ) : (
          <m.form
            key="form"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onSubmit={(e) => {
              e.preventDefault();
              ode();
            }}
            className="space-y-3.5"
          >
            <div className="flex items-center gap-3 pr-10">
              <KategoriIkon kod={yer.kategori ?? "YAKIT"} buyuk />
              <p className="min-w-0 truncate text-[1.2rem] font-extrabold tracking-[-0.02em]">{yer.yer}</p>
            </div>
            <div>
              <p className="text-[13px] text-[var(--a-ikincil)]">Kalan borç</p>
              <p className="text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] text-[#e11d48] tabular-nums">{tlYazKisa(yer.kalan)}</p>
            </div>

            <div>
              <label htmlFor="veresiye-odeme-tutar" className="sf-etiket">
                Ödeme tutarı
              </label>
              <div className={`sf-alan !min-h-[4rem] ${fazla ? "!border-[#f87171]" : ""}`}>
                <span className="text-[1.6rem] font-extrabold text-[var(--a-murekkep)]" aria-hidden>
                  ₺
                </span>
                <input
                  id="veresiye-odeme-tutar"
                  value={tutar}
                  onChange={(e) => {
                    setHata(null);
                    setTutar(tlGirisBicimle(e.target.value));
                  }}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="sf-girdi !text-[1.9rem] !font-extrabold tabular-nums"
                />
                {tutar && (
                  <button type="button" onClick={() => setTutar("")} aria-label="Tutarı temizle" className="vd-temizle">
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="sf-segment" role="group" aria-label="Hızlı tutar">
              {(
                [
                  ["tamami", "Tamamı", yer.kalan],
                  ["yarisi", "Yarısı", Math.round(yer.kalan / 2)],
                ] as const
              ).map(([k, ad, kurus]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={secili === k}
                  onClick={() => {
                    setHata(null);
                    setTutar(girisYaz(kurus));
                  }}
                  className={`sf-segment-oge relative ${secili === k ? "!text-white" : ""}`}
                >
                  {secili === k && <m.span layoutId="vd-hizli" className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6d6af8] to-[#4338ca] shadow-[0_8px_16px_-10px_rgba(79,70,229,0.9)]" transition={yay} aria-hidden />}
                  <span className="relative">{ad}</span>
                </button>
              ))}
            </div>

            <AnimatePresence initial={false} mode="wait">
              {fazla ? (
                <m.p
                  key="fazla"
                  role="alert"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-[1.1rem] bg-[#fee2e2] px-4 py-3 text-[13.5px] font-semibold text-[#b91c1c]"
                >
                  Kalan borç {tlYazKisa(yer.kalan)}. Daha fazla yazamazsın.
                </m.p>
              ) : (
                <m.div
                  key="sonra"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex items-center justify-between gap-3 rounded-[1.1rem] px-4 py-3 ${sonra === 0 ? "bg-[#dcfce7]" : "bg-[#ecfdf3]"}`}
                >
                  <span className="text-[13.5px] text-[#3b4262]">Ödeme sonrası kalan borç</span>
                  <span className="text-[1.1rem] font-extrabold tabular-nums text-[#15803d]">
                    {tlYazKisa(sonra)}
                    {sonra === 0 && <span className="ml-1.5 text-[12px] font-bold">kapanır</span>}
                  </span>
                </m.div>
              )}
            </AnimatePresence>

            {hata && !fazla && (
              <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13px] font-semibold text-[#b91c1c]">
                {hata}
              </p>
            )}

            <button type="submit" disabled={bekliyor || fazla || !girilen} className="ana-ana-dugme w-full !min-h-12 !text-[15px] disabled:opacity-60">
              {bekliyor ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                  Kaydediliyor…
                </>
              ) : (
                "Ödemeyi yaz"
              )}
            </button>
            <button type="button" onClick={kapat} disabled={bekliyor} className="sf-ikincil-dugme w-full !min-h-12">
              Vazgeç
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[12px] text-[var(--a-ikincil)]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold" aria-hidden>
                i
              </span>
              Ödeme kaydıdır; para göndermez.
            </p>
          </m.form>
        )}
      </AnimatePresence>
    </>
  );
}

function YerKarti({ y, acik, ac, odemeAc }: { y: VeresiyeGorunum; acik: boolean; ac: () => void; odemeAc: () => void }) {
  const [tumu, setTumu] = useState(false);
  const gorunen = tumu ? y.hareketler : y.hareketler.slice(0, 3);
  return (
    <section className="vd-kart">
      <button type="button" onClick={ac} aria-expanded={acik} className="vd-kart-bas">
        <KategoriIkon kod={y.kategori ?? "YAKIT"} buyuk />
        <span className="min-w-0 flex-1 truncate text-left text-[16.5px] font-extrabold tracking-[-0.01em]">{y.yer}</span>
        {!acik && (
          <span className="shrink-0 text-right">
            <span className="block text-[11.5px] text-[var(--a-ikincil)]">Kalan</span>
            <span className={`block text-[15px] font-extrabold tabular-nums ${y.kalan > 0 ? "text-[#e11d48]" : "text-[#15803d]"}`}>
              {y.kalan > 0 ? tlYazKisa(y.kalan) : "Borç yok"}
            </span>
          </span>
        )}
        <m.span animate={{ rotate: acik ? 90 : 0 }} transition={yay} className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
          ›
        </m.span>
      </button>

      <AnimatePresence initial={false}>
        {acik && (
          <m.div
            key="icerik"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5">
              <div className="grid grid-cols-3 rounded-[1.1rem] border border-[var(--a-cizgi)]">
                {(
                  [
                    ["Alınan", y.alinan, "text-[var(--a-murekkep)]"],
                    ["Ödenen", y.odenen, "text-[#15803d]"],
                    ["Kalan", y.kalan, y.kalan > 0 ? "text-[#e11d48]" : "text-[#15803d]"],
                  ] as const
                ).map(([ad, kurus, renk], i) => (
                  <div key={ad} className={`px-2.5 py-2.5 ${i > 0 ? "border-l border-[var(--a-cizgi)]" : ""}`}>
                    <p className="text-[11.5px] text-[var(--a-ikincil)]">{ad}</p>
                    <p className={`text-[15px] font-extrabold tabular-nums ${renk}`}>{tlYazKisa(kurus)}</p>
                  </div>
                ))}
              </div>

              {y.hareketler.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[14px] font-extrabold">Hareketler</p>
                    {y.hareketler.length > 3 && (
                      <button type="button" onClick={() => setTumu((t) => !t)} className="ana-link text-[12.5px]">
                        {tumu ? "Daha az" : `Tümü (${y.hareketler.length}) →`}
                      </button>
                    )}
                  </div>
                  <ul className="mt-1">
                    {gorunen.map((h) => {
                      const satir = (
                        <>
                          <span className={`h-3.5 w-[3px] shrink-0 rounded-full ${h.odeme ? "bg-[#16a34a]" : "bg-[#e11d48]"}`} aria-hidden />
                          <span className="w-[6.6rem] shrink-0 text-[12.5px] text-[var(--a-ikincil)]">{tarihBicim.format(new Date(h.tarihIso))}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px]">{h.ad}</span>
                          <span className={`shrink-0 text-[13.5px] font-bold tabular-nums ${h.odeme ? "text-[#15803d]" : "text-[#e11d48]"}`}>
                            {h.odeme ? "−" : "+"}
                            {tlYazKisa(h.tutar)}
                          </span>
                        </>
                      );
                      return (
                        <li key={h.anahtar} className="border-b border-[var(--a-cizgi)] last:border-0">
                          {h.href ? (
                            <Link href={h.href} className="vd-hareket">
                              {satir}
                            </Link>
                          ) : (
                            <div className="vd-hareket">{satir}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <button type="button" onClick={odemeAc} disabled={y.kalan <= 0} className="ana-ana-dugme mt-3 w-full !min-h-12 !text-[15px] disabled:opacity-50">
                {y.kalan > 0 ? "Ödeme yaz" : "Borç kapandı"}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Veresiye defteri sayfası: alımlar gider olarak bir kez sayılır, ödemeler yalnızca borcu düşer. */
export default function VeresiyeDefteri({ yerler, ornek = false }: { yerler: VeresiyeGorunum[]; ornek?: boolean }) {
  const [odeme, setOdeme] = useState<VeresiyeGorunum | null>(null);
  const [acikYer, setAcikYer] = useState<string | null>(yerler.find((y) => y.kalan > 0)?.yer ?? yerler[0]?.yer ?? null);
  const [panelAcik, setPanelAcik] = useState(false);
  const [kilit, setKilit] = useState(false);
  // Kapanırken içerik boşalmasın: seçili yer kalır, yalnız panel kapanır
  const kapat = useCallback(() => setPanelAcik(false), []);
  const toplam = yerler.reduce((t, y) => t + y.kalan, 0);
  const borcluYer = yerler.filter((y) => y.kalan > 0).length;
  // Veresiye gider kısayolu: açık kartın yeri hazır gelsin
  const yeniHref = `/giderler/yeni?odeme=VERESIYE${acikYer ? `&yer=${encodeURIComponent(acikYer)}` : ""}`;

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <header className="ana-ust sf-liste-ust">
          <div className="ana-ust-zemin" aria-hidden />
          <div className="ana-ic relative">
            <div className="ana-gir flex items-center justify-between gap-3 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <Image src="/ana/logo-2.png" alt="" width={40} height={36} className="h-9 w-10 shrink-0" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-white">Nakliye Defteri</p>
                  <p className="text-[12px] font-semibold text-[#9fb0ff]">Yük Avcısı</p>
                </div>
              </div>
              <BildirimZili tema="cam" />
            </div>
            <div className="relative mt-3">
              <div className="ana-gir relative z-10 max-w-[64%]" style={{ animationDelay: "40ms" }}>
                <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Veresiye defteri</h1>
                <p className="mt-3 text-[14px] text-[#c7cffd]">Toplam borç</p>
                <p className="text-[2.3rem] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">{tlYazKisa(toplam)}</p>
                <p className="mt-1.5 text-[13px] text-[#aab4ee]">
                  {yerler.length === 0 ? "Henüz veresiye alım yok" : borcluYer > 0 ? `${borcluYer} yere borç var` : "Tüm borçlar kapandı"}
                </p>
              </div>
              <Image src="/ana/veresiye-pompa.png" alt="" width={150} height={150} className="gd-ust-gorsel" priority />
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10 space-y-3 pb-6">
          {yerler.length === 0 && (
            <div className="vd-kart ana-gir px-5 py-7 text-center text-[14.5px] text-[#3b4262]">
              Gider girerken ödeme şeklini <b>Veresiye</b> seç; burada yer yer toplanır.
            </div>
          )}
          {yerler.map((y, i) => (
            <div key={y.yer} className="ana-gir" style={{ animationDelay: `${Math.min(80 + i * 50, 300)}ms` }}>
              <YerKarti y={y} acik={acikYer === y.yer} ac={() => setAcikYer(acikYer === y.yer ? null : y.yer)} odemeAc={() => {
                  setOdeme(y);
                  setPanelAcik(true);
                }} />
            </div>
          ))}
          <Link href={yeniHref} className="vd-yeni ana-gir" style={{ animationDelay: "200ms" }}>
            <span className="text-[20px] leading-none" aria-hidden>
              +
            </span>
            Veresiye gider
          </Link>
        </div>

        <AltPanel acik={panelAcik} etiket={odeme ? `${odeme.yer} ödemesi` : "Ödeme"} kapat={kapat} kilitli={kilit}>
          {odeme && <OdemeIcerik key={odeme.yer} yer={odeme} ornek={ornek} kapat={kapat} kilitle={setKilit} />}
        </AltPanel>
      </HareketKok>
    </div>
  );
}
