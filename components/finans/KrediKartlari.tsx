"use client";

import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { kartKaydet, kartOdemeYap, kartSil, type KartSonuc } from "@/app/actions";
import AltPanel from "@/components/ana/AltPanel";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { tlGirisBicimle, tlKurusaCevir, tlYazKisa } from "@/lib/para";

export type KartGorunum = {
  id: number;
  ad: string;
  sonOdemeGunu: number;
  borc: number;
  odenen: number;
  kalan: number;
  sonOdemeIso: string;
  kalanGun: number;
  /** Bu ekstreden sonraki ödeme kayıtları (yeniden eskiye) */
  odemeler: { id: number; tarihIso: string; tutar: number }[];
};

const tarihBicim = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const yay = { type: "spring", stiffness: 420, damping: 38 } as const;

function girisYaz(kurus: number) {
  return tlGirisBicimle(String(kurus / 100).replace(".", ","));
}

function gunRozeti(g: number): { yazi: string; ton: string } {
  if (g < 0) return { yazi: `${-g} gün geçti`, ton: "bg-[#fee2e2] text-[#b91c1c]" };
  if (g === 0) return { yazi: "Son gün bugün", ton: "bg-[#fee2e2] text-[#b91c1c]" };
  if (g <= 5) return { yazi: `${g} gün kaldı`, ton: "bg-[#fff1dc] text-[#c2410c]" };
  return { yazi: `${g} gün kaldı`, ton: "bg-[#eef0f8] text-[#4b5375]" };
}

/** Görsel kart yüzü (çip + ad); gerçek kart numarası/bilgisi tutulmaz. */
function KartYuzu({ k }: { k: KartGorunum }) {
  return (
    <div className="kk-yuz">
      <span className="kk-cip" aria-hidden>
        <svg viewBox="0 0 40 30" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.4">
          <rect x="1" y="1" width="38" height="28" rx="6" />
          <path d="M14 1v28M26 1v28M1 11h13M26 11h13M1 19h13M26 19h13" />
        </svg>
      </span>
      <div className="relative min-w-0">
        <p className="truncate text-[1.35rem] font-extrabold tracking-[-0.02em] text-white">{k.ad}</p>
        <p className="text-[12.5px] text-[#c7d0fb]">Manuel borç takibi</p>
      </div>
      <svg viewBox="0 0 260 70" className="kk-yol" fill="none" aria-hidden>
        <path d="M30 52c40 4 60-26 110-18s70 4 92-26" stroke="rgba(160,180,255,.75)" strokeWidth="2.2" strokeDasharray="6 6" />
        <circle cx="30" cy="52" r="5" fill="#60a5fa" />
        <path d="M232 2a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8z" fill="#93c5fd" />
      </svg>
      <p className="kk-kalan">
        <span className="block text-[11px] text-[#c7d0fb]">{k.kalan > 0 ? "Kalan borç" : "Borç yok"}</span>
        <span className="block text-[1.15rem] font-extrabold tabular-nums text-white">{tlYazKisa(k.kalan)}</span>
      </p>
    </div>
  );
}

function OdemeIcerik({ kart, ornek, kapat, kilitle }: { kart: KartGorunum; ornek: boolean; kapat: () => void; kilitle: (k: boolean) => void }) {
  const router = useRouter();
  const [tutar, setTutar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bitti, setBitti] = useState(false);
  const [bekliyor, baslat] = useTransition();
  useEffect(() => kilitle(bekliyor), [bekliyor, kilitle]);

  const girilen = tlKurusaCevir(tutar);
  const fazla = girilen !== null && girilen > kart.kalan;
  const sonra = girilen !== null && girilen > 0 && !fazla ? kart.kalan - girilen : kart.kalan;
  const yarisi = Math.round(kart.kalan / 2);
  const secili = girilen === kart.kalan ? "tamami" : girilen === yarisi ? "yarisi" : null;

  function kaydet() {
    setHata(null);
    if (girilen === null || girilen <= 0) return setHata("Ödeme tutarını yaz (örn. 5.000).");
    if (fazla) return;
    baslat(async () => {
      // Önizlemede gerçek kayıt yok; yalnızca bekleme/başarı akışı gösterilir.
      const r = ornek ? await new Promise<KartSonuc>((ok) => setTimeout(() => ok({ hata: null, tamam: true }), 700)) : await kartOdemeYap(kart.id, tutar);
      if (r.hata) return setHata(r.hata);
      setBitti(true);
      if (!ornek) router.refresh();
      setTimeout(kapat, 1200);
    });
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {bitti ? (
        <m.div key="bitti" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={yay} className="flex flex-col items-center gap-2 py-10" role="status">
          <svg viewBox="0 0 52 52" className="h-16 w-16" aria-hidden>
            <circle cx="26" cy="26" r="24" fill="#dcfce7" />
            <path className="onay-cizgi" d="M15 27l7 7 15-15" fill="none" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[17px] font-extrabold">Ödeme kaydedildi</p>
          <p className="text-[13.5px] text-[var(--a-ikincil)]">
            {kart.ad} kalan borç: <b className="text-[var(--a-murekkep)]">{tlYazKisa(sonra)}</b>
          </p>
        </m.div>
      ) : (
        <m.form
          key="form"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onSubmit={(e) => {
            e.preventDefault();
            kaydet();
          }}
          className="space-y-3.5"
        >
          <div className="pr-10">
            <p className="text-[1.15rem] font-extrabold tracking-[-0.02em]">{kart.ad}</p>
            <p className="text-[13px] text-[var(--a-ikincil)]">
              Kalan borç <b className="text-[#dc2626] tabular-nums">{tlYazKisa(kart.kalan)}</b>
            </p>
          </div>
          <div>
            <label htmlFor="kart-odeme-tutar" className="sf-etiket">
              Ödeme tutarı
            </label>
            <div className={`sf-alan !min-h-[3.6rem] ${fazla ? "!border-[#f87171]" : ""}`}>
              <span className="sf-alan-ikon" aria-hidden>
                ₺
              </span>
              <input
                id="kart-odeme-tutar"
                value={tutar}
                onChange={(e) => {
                  setHata(null);
                  setTutar(tlGirisBicimle(e.target.value));
                }}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className="sf-girdi !text-[1.5rem] !font-extrabold tabular-nums"
              />
              {tutar && (
                <button type="button" onClick={() => setTutar("")} aria-label="Tutarı temizle" className="vd-temizle">
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Hızlı tutar">
            {(
              [
                ["tamami", `Tamamı (${tlYazKisa(kart.kalan)})`, kart.kalan],
                ["yarisi", `Yarısı (${tlYazKisa(yarisi)})`, yarisi],
              ] as const
            ).map(([kod, ad, kurus]) => (
              <button
                key={kod}
                type="button"
                aria-pressed={secili === kod}
                onClick={() => {
                  setHata(null);
                  setTutar(girisYaz(kurus));
                }}
                className={`kk-hizli relative ${secili === kod ? "!text-white" : ""}`}
              >
                {secili === kod && (
                  <m.span layoutId="kart-hizli" className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6d6af8] to-[#4338ca]" transition={yay} aria-hidden />
                )}
                <span className="relative">{ad}</span>
              </button>
            ))}
          </div>

          <AnimatePresence initial={false} mode="wait">
            {fazla ? (
              <m.p key="fazla" role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="rounded-[1.1rem] bg-[#fee2e2] px-4 py-3 text-[13.5px] font-semibold text-[#b91c1c]">
                Kalan borç {tlYazKisa(kart.kalan)}. Daha fazla yazamazsın.
              </m.p>
            ) : (
              <m.div
                key="sonra"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex items-center justify-between gap-3 rounded-[1.1rem] px-4 py-3 ${sonra === 0 ? "bg-[#dcfce7]" : "bg-[#f1f3fc]"}`}
              >
                <span className="text-[13.5px] text-[#3b4262]">Ödeme sonrası kalan borç</span>
                <span className={`text-[1.1rem] font-extrabold tabular-nums ${sonra === 0 ? "text-[#15803d]" : ""}`}>
                  {tlYazKisa(sonra)}
                  {sonra === 0 && <span className="ml-1.5 text-[12px] font-bold">kapanır</span>}
                </span>
              </m.div>
            )}
          </AnimatePresence>

          {hata && (
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
              "Kaydet"
            )}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-[var(--a-ikincil)]">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold" aria-hidden>
              i
            </span>
            Para transferi yapmaz. Manuel kayıt içindir.
          </p>
        </m.form>
      )}
    </AnimatePresence>
  );
}

function KartFormIcerik({ kart, kapat }: { kart: KartGorunum | null; kapat: () => void }) {
  const [durum, gonder, bekliyor] = useActionState<KartSonuc, FormData>(
    async (o, f) => {
      const r = await kartKaydet(o, f);
      if (r.tamam) setTimeout(kapat, 900);
      return r;
    },
    { hata: null, tamam: false }
  );
  const [siliniyor, setSiliniyor] = useState(false);

  if (durum.tamam) {
    return (
      <m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={yay} className="flex flex-col items-center gap-2 py-10" role="status">
        <svg viewBox="0 0 52 52" className="h-16 w-16" aria-hidden>
          <circle cx="26" cy="26" r="24" fill="#dcfce7" />
          <path className="onay-cizgi" d="M15 27l7 7 15-15" fill="none" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-[17px] font-extrabold">{kart ? "Kart güncellendi" : "Kart eklendi"}</p>
      </m.div>
    );
  }

  return (
    <form action={gonder} className="space-y-3">
      <p className="pr-10 text-[1.15rem] font-extrabold tracking-[-0.02em]">{kart ? `${kart.ad} · ekstre` : "Kredi kartı ekle"}</p>
      {kart && <input type="hidden" name="kartId" value={kart.id} />}
      <div>
        <label htmlFor="kart-ad" className="sf-etiket">
          Kart adı
        </label>
        <div className="sf-alan">
          <input id="kart-ad" name="ad" required defaultValue={kart?.ad} placeholder="Örn. İş kartım" className="sf-girdi" autoComplete="off" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="kart-borc" className="sf-etiket">
            Ekstre borcu (₺)
          </label>
          <div className="sf-alan">
            <input id="kart-borc" name="borc" inputMode="decimal" defaultValue={kart ? girisYaz(kart.borc) : ""} placeholder="0" className="sf-girdi" />
          </div>
        </div>
        <div>
          <label htmlFor="kart-gun" className="sf-etiket">
            Son ödeme günü
          </label>
          <div className="sf-alan">
            <input id="kart-gun" name="sonOdemeGunu" inputMode="numeric" required defaultValue={kart?.sonOdemeGunu} placeholder="Ayın 15'i → 15" className="sf-girdi" />
          </div>
        </div>
      </div>
      {kart && (
        <label className="flex items-start gap-2.5 rounded-[1.1rem] bg-[#f4f6fc] p-3 text-[13.5px]">
          <input type="checkbox" name="yeniEkstre" value="1" defaultChecked className="mt-0.5 h-4 w-4 accent-[#4f46e5]" />
          <span>
            Bu yeni ayın ekstresi
            <span className="block text-[12px] text-[var(--a-ikincil)]">Önceki ödemeler sıfırlanır, kalan yeni borçtan hesaplanır. Sadece adı / günü düzeltiyorsan kaldır.</span>
          </span>
        </label>
      )}
      {durum.hata && (
        <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13px] font-semibold text-[#b91c1c]">
          {durum.hata}
        </p>
      )}
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-12 !text-[15px] disabled:opacity-60">
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
      {kart && (
        <button
          type="button"
          disabled={siliniyor}
          onClick={async () => {
            if (!window.confirm(`${kart.ad} silinsin mi? Ödeme geçmişi de silinir.`)) return;
            setSiliniyor(true);
            await kartSil(kart.id);
            kapat();
          }}
          className="w-full py-2 text-[13.5px] font-semibold text-[#dc2626]"
        >
          {siliniyor ? "Siliniyor…" : "Kartı sil"}
        </button>
      )}
    </form>
  );
}

/** Kredi kartları sayfası: elle girilen ekstre borcu, ödemeler, kalan; banka bağlantısı yok. */
export default function KrediKartlari({ kartlar, ornek = false }: { kartlar: KartGorunum[]; ornek?: boolean }) {
  const router = useRouter();
  const [secili, setSecili] = useState(0);
  const [panel, setPanel] = useState<"odeme" | "duzen" | "yeni">("odeme");
  // Kapanırken içerik boşalmasın: tür ve kart kalır, yalnız panel kapanır
  const [panelAcik, setPanelAcik] = useState(false);
  const [panelKart, setPanelKart] = useState<KartGorunum | null>(null);
  const [kilit, setKilit] = useState(false);
  const serit = useRef<HTMLDivElement>(null);
  const kapat = useCallback(() => setPanelAcik(false), []);
  const k = kartlar[Math.min(secili, kartlar.length - 1)];
  const toplam = kartlar.reduce((t, x) => t + x.kalan, 0);
  const rozet = k ? gunRozeti(k.kalanGun) : null;

  function kaydir(i: number) {
    const serEl = serit.current;
    const el = serEl?.children[i] as HTMLElement | undefined;
    if (!serEl || !el) return;
    // Yalnız yatay kaydır (scrollIntoView sayfayı da dikey kaydırıyordu)
    const azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    serEl.scrollTo({ left: el.offsetLeft - (serEl.clientWidth - el.clientWidth) / 2, behavior: azalt ? "auto" : "smooth" });
  }

  function ac(tur: "odeme" | "duzen" | "yeni") {
    setPanelKart(tur === "yeni" ? null : (k ?? null));
    setPanel(tur);
    setPanelAcik(true);
  }

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <header className="ana-ust kk-ust">
          <div className="ana-ust-zemin" aria-hidden />
          <div className="ana-ic relative">
            <div className="ana-gir flex items-center justify-between gap-3 pt-3">
              <button
                type="button"
                onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
                aria-label="Geri"
                className="ana-zil flex h-10 w-10 items-center justify-center rounded-full text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </button>
              <h1 className="text-[1.35rem] font-extrabold tracking-[-0.02em] text-white">Kredi kartları</h1>
              <button type="button" onClick={() => ac("yeni")} aria-label="Kart ekle" className="ana-zil flex h-10 w-10 items-center justify-center rounded-full text-[1.4rem] text-white">
                +
              </button>
            </div>
            {kartlar.length > 1 && (
              <p className="ana-gir mt-2 text-center text-[13px] text-[#c7cffd]" style={{ animationDelay: "40ms" }}>
                {kartlar.length} kart · toplam kalan <b className="text-white tabular-nums">{tlYazKisa(toplam)}</b>
              </p>
            )}
          </div>
        </header>

        <div className="relative z-10 -mt-[8.6rem] pb-6">
          {kartlar.length === 0 ? (
            <div className="ana-ic">
              <div className="kk-yuz ana-gir !flex-col !items-start !justify-center gap-2" style={{ animationDelay: "60ms" }}>
                <p className="relative text-[1.2rem] font-extrabold text-white">Kart borçlarını takip et</p>
                <p className="relative text-[13px] text-[#c7d0fb]">Kartı ekle; son ödeme gününe 3 gün kala hatırlatayım, ödedikçe kalan borç düşsün.</p>
              </div>
              <button type="button" onClick={() => ac("yeni")} className="ana-ana-dugme mt-4 w-full !min-h-12 !text-[15px]">
                + Kart ekle
              </button>
            </div>
          ) : (
            <>
              <div
                ref={serit}
                className="kk-serit ana-gir"
                style={{ animationDelay: "60ms" }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth * 0.86));
                  if (i !== secili && i >= 0 && i < kartlar.length) setSecili(i);
                }}
              >
                {kartlar.map((x) => (
                  <div key={x.id} className="kk-serit-oge">
                    <KartYuzu k={x} />
                  </div>
                ))}
              </div>

              {kartlar.length > 1 && (
                <div className="mt-2 flex justify-center gap-1.5" role="tablist" aria-label="Kartlar">
                  {kartlar.map((x, i) => (
                    <button key={x.id} type="button" role="tab" aria-selected={i === secili} aria-label={x.ad} onClick={() => kaydir(i)} className="kk-nokta">
                      <span className={`block h-2 rounded-full transition-all duration-200 ${i === secili ? "w-5 bg-[#4f46e5]" : "w-2 bg-[#c9cee3]"}`} />
                    </button>
                  ))}
                </div>
              )}

              {k && rozet && (
                <div className="ana-ic">
                  <AnimatePresence mode="wait" initial={false}>
                    <m.section
                      key={k.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 rounded-[1.5rem] bg-white p-3.5 shadow-[var(--a-golge)]"
                      aria-label={`${k.ad} özeti`}
                    >
                      <div className="grid grid-cols-3">
                        {(
                          [
                            ["Ekstre", k.borc, ""],
                            ["Ödenen", k.odenen, "text-[#16a34a]"],
                            ["Kalan", k.kalan, k.kalan > 0 ? "text-[#dc2626]" : "text-[#16a34a]"],
                          ] as const
                        ).map(([ad, kurus, renk], i) => (
                          <div key={ad} className={`px-2 ${i > 0 ? "border-l border-[var(--a-cizgi)]" : ""}`}>
                            <p className="text-[12px] text-[var(--a-ikincil)]">{ad}</p>
                            <p className={`text-[1.05rem] font-extrabold tabular-nums ${renk}`}>{tlYazKisa(kurus)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-3 rounded-[1.1rem] bg-[#f6f7fc] px-3 py-2.5">
                        <span className="ks-yon-ikon bg-white text-[#4f46e5]" aria-hidden>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="4" y="5" width="16" height="15" rx="2" />
                            <path d="M4 10h16M9 3v4M15 3v4" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block text-[12.5px] text-[var(--a-ikincil)]">Son ödeme</span>
                          <span className="block text-[14.5px] font-bold">{tarihBicim.format(new Date(k.sonOdemeIso))}</span>
                        </span>
                        {k.kalan > 0 && <span className={`sf-rozet !text-[12px] ${rozet.ton}`}>{rozet.yazi}</span>}
                      </div>
                    </m.section>
                  </AnimatePresence>

                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => ac("odeme")} disabled={k.kalan <= 0} className="ana-ana-dugme !min-h-12 gap-2 !text-[14.5px] disabled:opacity-50">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden>
                        <rect x="4" y="5" width="16" height="15" rx="2" />
                        <path d="M4 10h16M9 3v4M15 3v4" />
                      </svg>
                      {k.kalan > 0 ? "Ödeme kaydet" : "Borç yok"}
                    </button>
                    <button type="button" onClick={() => ac("yeni")} className="kk-cerceve-dugme">
                      <span className="text-[1.2rem] leading-none" aria-hidden>
                        +
                      </span>
                      Kart ekle
                    </button>
                  </div>
                  <button type="button" onClick={() => ac("duzen")} className="sf-ikincil-dugme mt-2.5 w-full">
                    Yeni ekstre / kartı düzenle
                  </button>

                  <section className="mt-5" aria-labelledby="son-odemeler">
                    <div className="flex items-baseline justify-between px-1">
                      <h2 id="son-odemeler" className="ana-baslik">
                        Son ödemeler
                      </h2>
                      <span className="text-[12px] text-[var(--a-ikincil)]">Bu ekstre dönemi</span>
                    </div>
                    {k.odemeler.length === 0 ? (
                      <p className="mt-2 rounded-[1.4rem] bg-white px-5 py-6 text-center text-[14px] text-[#3b4262] shadow-[var(--a-golge)]">Bu ekstreye henüz ödeme yazılmadı.</p>
                    ) : (
                      <ul className="mt-2 rounded-[1.4rem] bg-white px-4 shadow-[var(--a-golge)]">
                        {k.odemeler.map((o) => (
                          <li key={o.id} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-3 last:border-0">
                            <span className="w-[6.8rem] shrink-0 text-[12.5px] text-[var(--a-ikincil)]">{tarihBicim.format(new Date(o.tarihIso))}</span>
                            <span className="ana-mini-ikon ana-ton-kirmizi !h-8 !w-8" aria-hidden>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="6" width="18" height="13" rx="2" />
                                <path d="M3 10h18" />
                              </svg>
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[14px]">Kart ödemesi</span>
                            <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{tlYazKisa(o.tutar)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>

        <AltPanel acik={panelAcik} etiket={panel === "odeme" ? "Kart ödemesi" : "Kart bilgisi"} kapat={kapat} kilitli={kilit}>
          {panel === "odeme" && panelKart && <OdemeIcerik key={`o${panelKart.id}`} kart={panelKart} ornek={ornek} kapat={kapat} kilitle={setKilit} />}
          {(panel === "duzen" || panel === "yeni") && <KartFormIcerik key={panel === "yeni" ? "yeni" : `d${panelKart?.id}`} kart={panel === "yeni" ? null : panelKart} kapat={kapat} />}
        </AltPanel>
      </HareketKok>
    </div>
  );
}
