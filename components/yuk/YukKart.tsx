"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { ilanDurumGuncelle, ilanSil, ilanYanlisNumara } from "@/app/ai-actions";
import BilgiSorButonu from "@/components/BilgiSorButonu";
import { aracBelirsizMi, aracTipiAdi } from "@/lib/arac";
import { fiyatGorunumu, gecenSure } from "@/lib/ilanGorunum";
import { tlYazKisa } from "@/lib/para";
import { whatsappMesajUrl } from "@/lib/whatsapp";
import RotaCizgi from "@/components/yuk/RotaCizgi";
import { anaYazi } from "@/components/ana/yazi";

const bosAbone = () => () => {};

export type IlanKartKar = {
  mesafe: string | null;
  yakit: string | null;
  hgs: string | null;
  net: string | null;
  tlKm: string | null;
  uyari: string | null;
  netPozitif?: boolean;
};

export type IlanKartVeri = {
  id: number;
  durum: string;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  tonaj: number | null;
  yukTipi?: string | null;
  aracTipi: string | null;
  aracTipiKod: string | null;
  aracUzunluk?: number | null;
  koridorTipi?: string | null;
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz: boolean;
  firmaAdi: string | null;
  telefon: string | null;
  /** Asistanın WhatsApp sorusu: sırada, yazıldı, cevap yok veya konuşma özeti. */
  waNot?: string | null;
  gonderenUserId: string | null;
  guvenSkoru: number;
  hamMetin: string;
  createdAt: Date | string;
  sonGorulme?: Date | string | null;
  donusTalebiId: number | null;
  kaynakAd: string | null;
  ucretYazi: string | null;
  odakli?: boolean;
  soluk?: boolean;
  vurgulu?: boolean;
  kar?: IlanKartKar | null;
  donusOnerileri?: { id: number; rota: string; fiyat: string | null }[];
};

const TAKIP_DURUMLARI = ["ILGILENIYOR", "ILETISIME_GECILDI", "PAZARLIKTA", "CEVAP_YOK", "ALINDI"];

const DURUM_ROZET: Record<string, { yazi: string; sinif: string }> = {
  ILGILENIYOR: { yazi: "Takipte", sinif: "bg-[#eceeff] text-[#4338ca]" },
  ILETISIME_GECILDI: { yazi: "Arandı", sinif: "bg-[#e0ecff] text-[#1d4ed8]" },
  PAZARLIKTA: { yazi: "Pazarlık", sinif: "bg-[#fff1dc] text-[#c2410c]" },
  CEVAP_YOK: { yazi: "Cevap yok", sinif: "bg-[#eef0f5] text-[#5b6280]" },
  ALINDI: { yazi: "Alındı", sinif: "bg-[#dcfce7] text-[#15803d]" },
  ELENDI: { yazi: "Elendi", sinif: "bg-[#fee2e2] text-[#b91c1c]" },
};

const DURUM_SECENEK = [
  { kod: "ILGILENIYOR", ad: "Takipte" },
  { kod: "ILETISIME_GECILDI", ad: "Arandı" },
  { kod: "PAZARLIKTA", ad: "Pazarlıkta" },
  { kod: "CEVAP_YOK", ad: "Cevap yok" },
  { kod: "ALINDI", ad: "Alındı" },
  { kod: "ELENDI", ad: "Geç (listeden çıkar)" },
];

function tarihi(t: Date | string | null | undefined): Date | null {
  if (!t) return null;
  return typeof t === "string" ? new Date(t) : t;
}

/** Fiyat: büyük tutar + niteleyici. KDV bilgisi ilanda yok → yazılmaz. */
function fiyatParcalari(ilan: IlanKartVeri) {
  const f = fiyatGorunumu(ilan);
  if (!f.ana) return { tutar: null as string | null, ek: "", alt: f.belirsiz ? "Fiyat belirsiz" : "Fiyat belirtilmemiş" };
  if (ilan.fiyatTon !== null && ilan.fiyatTon > 0) {
    return { tutar: tlYazKisa(ilan.fiyatTon), ek: "/ton", alt: f.tahmin ? `Ton başı · toplam ${f.tahmin}` : "Ton başı" };
  }
  return { tutar: tlYazKisa(ilan.ucret ?? 0), ek: "", alt: "Komple navlun" };
}

function bilgiSatiri(ilan: IlanKartVeri): string {
  return [
    ilan.tonaj ? `${ilan.tonaj} ton` : null,
    ilan.aracTipi ? (aracTipiAdi(ilan.aracTipi) ?? ilan.aracTipi) : null,
    ilan.aracUzunluk != null ? `${ilan.aracUzunluk.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m` : null,
    ilan.yukTipi || null,
  ]
    .filter(Boolean)
    .join(" • ");
}

/** Detay özellik ve işlem ikonları (çizgi, indigo) */
const IK: Record<string, React.ReactNode> = {
  agirlik: <path d="M6 9h12l2 11H4zM9 9a3 3 0 0 1 6 0" />,
  kasa: (
    <>
      <path d="M2 7.5h12V16H2zM14 10h4l3 3.5V16h-7" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="17.5" cy="17.5" r="1.6" />
    </>
  ),
  uzunluk: <path d="M3 12h18M6 8l-3 4 3 4M18 8l3 4-3 4" />,
  takvim: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  bina: <path d="M4 21V5l8-2v18M12 21h8V9l-8-2M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2" />,
  kutu: <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9" />,
  soru: <path d="M4 5h16v11H9l-5 4zM9 9.5h6M9 12.5h4" />,
  isaret: <path d="M6 3h12v18l-6-4-6 4z" />,
  arti: <path d="M12 5v14M5 12h14" />,
};
function Ik({ ad, className = "h-5 w-5" }: { ad: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {IK[ad]}
    </svg>
  );
}

function TirIkon({ turuncu }: { turuncu?: boolean }) {
  return (
    <span className={`yuk-ikon ${turuncu ? "yuk-ikon-turuncu" : ""}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V16H2z" />
        <path d="M14 10h3.6a1.5 1.5 0 0 1 1.2.6l2.2 2.9V16h-7z" opacity=".85" />
        <circle cx="6" cy="17" r="2" fill="#fff" />
        <circle cx="6" cy="17" r="1.1" />
        <circle cx="17.5" cy="17" r="2" fill="#fff" />
        <circle cx="17.5" cy="17" r="1.1" />
      </svg>
    </span>
  );
}

function Kalp({ dolu }: { dolu: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={dolu ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
    </svg>
  );
}

/** Ana listedeki ilan kartı; "İncele" detay panelini açar. */
export default function YukKart({ ilan, gorunum = "liste" }: { ilan: IlanKartVeri; gorunum?: "liste" | "takip" | "donus" }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [detay, setDetay] = useState(Boolean(ilan.odakli));
  const [durum, setDurum] = useState(ilan.durum);
  const [oncekiDurum, setOncekiDurum] = useState(ilan.durum);
  if (oncekiDurum !== ilan.durum) {
    setOncekiDurum(ilan.durum);
    setDurum(ilan.durum);
  }

  const taze = tarihi(ilan.sonGorulme) ?? tarihi(ilan.createdAt)!;
  const fiyat = fiyatParcalari(ilan);
  const cikis = ilan.nereden || ilan.cikisIl || "?";
  const varis = ilan.nereye || ilan.varisIl || null;
  const takipte = TAKIP_DURUMLARI.includes(durum);
  const rozet = DURUM_ROZET[durum] ?? (ilan.donusTalebiId || ilan.koridorTipi === "VARIS" ? { yazi: "Dönüş", sinif: "bg-[#ede9fe] text-[#6d28d9]" } : null);
  const waUrl = ilan.telefon ? whatsappMesajUrl(ilan.telefon, "") : null;
  const bilgi = bilgiSatiri(ilan);

  function durumYap(yeni: string) {
    setDurum(yeni);
    baslat(async () => {
      await ilanDurumGuncelle(ilan.id, yeni);
      router.refresh();
    });
  }

  return (
    <>
      <article
        id={`ilan-${ilan.id}`}
        className={`yuk-kart ${ilan.vurgulu ? "yuk-kart-iyi" : ""} ${ilan.soluk || durum === "CEVAP_YOK" ? "opacity-75" : ""}`}
      >
        <button type="button" onClick={() => setDetay(true)} className="yuk-kart-govde" aria-label={`${cikis} → ${varis ?? "varış yok"} ilanını incele`}>
          <TirIkon turuncu={!fiyat.tutar} />
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate text-[16px] font-extrabold tracking-[-0.01em]">
                {cikis} <span className="text-[#8a90ad]">→</span> {varis ?? <span className="text-[14px] font-semibold text-[var(--a-ikincil)]">varış yok</span>}
              </span>
              {gorunum !== "liste" && rozet ? (
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${rozet.sinif}`}>{rozet.yazi}</span>
              ) : (
                <span className="shrink-0 pt-0.5 text-[11.5px] text-[var(--a-ikincil)]">{gecenSure(taze)}</span>
              )}
            </span>
            {bilgi && <span className="mt-0.5 block truncate text-[13px] text-[var(--a-ikincil)]">{bilgi}</span>}
            {fiyat.tutar ? (
              <span className="mt-2 block text-[1.45rem] font-extrabold leading-none tracking-[-0.02em] text-[#16a34a]">
                {fiyat.tutar}
                {fiyat.ek && <span className="text-[14px] font-bold">{fiyat.ek}</span>}
              </span>
            ) : (
              <span className="mt-2 block text-[15px] font-bold text-[#3b4262]">{fiyat.alt}</span>
            )}
            {fiyat.tutar && <span className="mt-1 block text-[12.5px] text-[var(--a-ikincil)]">{fiyat.alt}</span>}
            {gorunum !== "liste" && ilan.firmaAdi && (
              <span className="mt-1 block truncate text-[13px] font-medium text-[#3b4262]">{ilan.firmaAdi}</span>
            )}
            {gorunum !== "liste" && (
              <span className="mt-0.5 block text-[11.5px] text-[var(--a-ikincil)]">◷ {gecenSure(taze)}</span>
            )}
          </span>
        </button>

        {ilan.waNot && <p className="mx-1 mt-2 rounded-xl bg-[#f3f5fb] px-3 py-1.5 text-[12px] font-medium text-[#3b4262]">{ilan.waNot}</p>}

        {gorunum === "takip" ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {ilan.telefon ? (
                <a href={`tel:${ilan.telefon}`} className="yuk-iletisim">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[#16a34a]" aria-hidden>
                    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
                  </svg>
                  Ara
                </a>
              ) : (
                <span className="yuk-iletisim opacity-40">Ara</span>
              )}
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="yuk-iletisim">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[#16a34a]" aria-hidden>
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" />
                  </svg>
                  Mesaj
                </a>
              ) : (
                <span className="yuk-iletisim opacity-40">Mesaj</span>
              )}
            </div>
            <label className="yuk-durum">
              <span className="sr-only">Durumu değiştir</span>
              <select value={durum} disabled={bekliyor} onChange={(e) => durumYap(e.target.value)} className="yuk-durum-sec">
                {DURUM_SECENEK.map((d) => (
                  <option key={d.kod} value={d.kod}>
                    {d.ad}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none">{bekliyor ? "Kaydediliyor…" : "Durumu değiştir"}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="pointer-events-none h-4 w-4" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </label>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={bekliyor || takipte}
              onClick={() => durumYap("ILGILENIYOR")}
              aria-label={takipte ? "Takipte" : "Takibe al"}
              aria-pressed={takipte}
              className={`yuk-kalp ${takipte ? "text-[#ef4444]" : "text-[#8a90ad]"}`}
            >
              <Kalp dolu={takipte} />
            </button>
            {gorunum === "liste" && rozet && <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${rozet.sinif}`}>{rozet.yazi}</span>}
            <button type="button" onClick={() => setDetay(true)} className={gorunum === "donus" ? "ana-ana-dugme !min-h-10 flex-1 !text-[14px]" : fiyat.tutar ? "yuk-incele" : "yuk-incele yuk-incele-hafif"}>
              {gorunum === "donus" ? "İlanı gör" : fiyat.tutar ? "İncele" : "Detayı gör"}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </article>

      <IlanDetay acik={detay} kapat={() => setDetay(false)} ilan={{ ...ilan, durum }} durumYap={durumYap} bekliyor={bekliyor} />
    </>
  );
}

/** İlan detayı: alttan kısa, yumuşak yayla gelen tam ekran panel. */
function IlanDetay({
  acik,
  kapat,
  ilan,
  durumYap,
  bekliyor,
}: {
  acik: boolean;
  kapat: () => void;
  ilan: IlanKartVeri;
  durumYap: (d: string) => void;
  bekliyor: boolean;
}) {
  const router = useRouter();
  const [maliyetAcik, setMaliyetAcik] = useState(true);
  const [metinAcik, setMetinAcik] = useState(false);
  const [islem, baslatIslem] = useTransition();
  // Portal yalnız tarayıcıda (sunucu ve ilk çizim: null)
  const hazir = useSyncExternalStore(bosAbone, () => true, () => false);

  useEffect(() => {
    if (!acik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tus = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    window.addEventListener("keydown", tus);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", tus);
    };
  }, [acik, kapat]);

  if (!hazir) return null;

  const taze = tarihi(ilan.sonGorulme) ?? tarihi(ilan.createdAt)!;
  const fiyat = fiyatParcalari(ilan);
  const cikis = ilan.nereden || ilan.cikisIl || "?";
  const varis = ilan.nereye || ilan.varisIl || null;
  const takipte = TAKIP_DURUMLARI.includes(ilan.durum);
  const waUrl = ilan.telefon ? whatsappMesajUrl(ilan.telefon, "") : null;
  const iletisimVar = Boolean(ilan.gonderenUserId || ilan.telefon);
  const bugun = new Date().toDateString() === taze.toDateString();
  const uyarilar = [
    !ilan.varisIl && ilan.cikisIl ? "Varış belirtilmemiş" : null,
    ilan.koridorTipi === "CIKIS" && ilan.varisIl ? "Varış bölge dışında" : null,
    aracBelirsizMi(ilan.aracTipi, ilan.aracTipiKod) ? "Araç tipi belirsiz" : null,
    ilan.kar?.uyari || null,
  ].filter(Boolean) as string[];

  const ozellikler = [
    ilan.tonaj ? { ikon: "agirlik", deger: `${ilan.tonaj} ton`, ad: "Yük miktarı" } : null,
    ilan.aracTipi ? { ikon: "kasa", deger: aracTipiAdi(ilan.aracTipi) ?? ilan.aracTipi, ad: "Kasa tipi" } : null,
    ilan.aracUzunluk != null
      ? { ikon: "uzunluk", deger: `${ilan.aracUzunluk.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m`, ad: "Kasa uzunluğu" }
      : null,
    { ikon: "takvim", deger: bugun ? "Bugün" : taze.toLocaleDateString("tr-TR"), ad: `Paylaşıldı · ${gecenSure(taze)}` },
    ilan.firmaAdi ? { ikon: "bina", deger: ilan.firmaAdi, ad: "Yük sahibi" } : null,
    ilan.yukTipi ? { ikon: "kutu", deger: ilan.yukTipi, ad: "Yük cinsi" } : null,
  ].filter(Boolean) as { ikon: string; deger: string; ad: string }[];

  function seferimeEkle() {
    const p = new URLSearchParams();
    if (ilan.nereden) p.set("nereden", ilan.nereden);
    if (ilan.nereye) p.set("nereye", ilan.nereye);
    if (ilan.firmaAdi) p.set("firma", ilan.firmaAdi);
    if (ilan.ucretYazi) p.set("tutar", ilan.ucretYazi);
    baslatIslem(async () => {
      await ilanDurumGuncelle(ilan.id, "YUKE_DONDU");
      router.push(`/yukler/yeni?${p.toString()}`);
    });
  }

  const kar = ilan.kar;
  const maliyetSatirlari = kar
    ? ([
        kar.mesafe ? ["Tahmini mesafe", kar.mesafe] : null,
        kar.yakit ? ["Yakıt gideri (tahmini)", kar.yakit] : null,
        kar.hgs ? ["Yol / HGS (tahmini)", kar.hgs] : null,
        kar.tlKm ? ["Kilometre başına", `${kar.tlKm}/km`] : null,
        kar.net && kar.net !== "fiyat okunamadı" ? ["Tahmini net kalan", kar.net] : null,
      ].filter(Boolean) as [string, string][])
    : [];

  return createPortal(
    <AnimatePresence>
      {acik && (
        <m.div
          key="detay"
          className={`yuk-detay ana ${anaYazi.variable}`}
          role="dialog"
          aria-modal="true"
          aria-label={`İlan detayı: ${cikis} → ${varis ?? "varış yok"}`}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 40, mass: 0.9 }}
        >
          <div className="yuk-detay-ust">
            <div className="ana-ust-zemin" aria-hidden />
            <div className="relative mx-auto w-full max-w-[40rem] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
              <div className="flex items-center gap-3">
                <button type="button" onClick={kapat} aria-label="Geri" className="ana-zil flex h-10 w-10 items-center justify-center rounded-full text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M19 12H5M11 6l-6 6 6 6" />
                  </svg>
                </button>
                <div className="leading-tight">
                  <p className="text-[13px] font-semibold text-[#9fb0ff]">Nakliye Defteri</p>
                  <p className="text-[20px] font-extrabold tracking-[-0.02em] text-white">İlan detayı</p>
                </div>
              </div>
              <p className="mt-1 pl-[3.25rem] text-[13px] text-[#b8c1f5]">Yük bilgilerini incele</p>
              <div className="mt-2">
                <RotaCizgi sol={cikis} sag={varis} />
              </div>
            </div>
          </div>

          <div className="yuk-detay-govde">
            <div className="mx-auto w-full max-w-[40rem] px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
              <div className="flex items-start justify-between gap-3 pt-5">
                <div className="min-w-0">
                  {fiyat.tutar ? (
                    <p className="text-[2.1rem] font-extrabold leading-none tracking-[-0.03em] text-[#16a34a]">
                      {fiyat.tutar}
                      {fiyat.ek && <span className="text-[1.1rem]">{fiyat.ek}</span>}
                    </p>
                  ) : (
                    <p className="text-[1.4rem] font-extrabold text-[#3b4262]">{fiyat.alt}</p>
                  )}
                  {fiyat.tutar && <p className="mt-1 text-[14px] text-[var(--a-ikincil)]">{fiyat.alt}</p>}
                </div>
                <button
                  type="button"
                  disabled={bekliyor || takipte}
                  onClick={() => durumYap("ILGILENIYOR")}
                  aria-label={takipte ? "Takipte" : "Takibe al"}
                  aria-pressed={takipte}
                  className={`yuk-kalp !h-12 !w-12 ${takipte ? "text-[#ef4444]" : "text-[#ef4444]/70"}`}
                >
                  <Kalp dolu={takipte} />
                </button>
              </div>

              <div className="yuk-ozellikler mt-4">
                {ozellikler.map((o) => (
                  <div key={o.ad} className="yuk-ozellik">
                    <span className="yuk-ozellik-ikon" aria-hidden>
                      <Ik ad={o.ikon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-bold">{o.deger}</span>
                      <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">{o.ad}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {ilan.telefon ? (
                  <a href={`tel:${ilan.telefon}`} className="yuk-yesil">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
                    </svg>
                    Ara
                  </a>
                ) : (
                  <span className="yuk-yesil opacity-40">Ara</span>
                )}
                {waUrl ? (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="yuk-yesil">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.24.68-1.42 1.3-1.96 1.35-.5.05-1.13.07-1.82-.11a16.6 16.6 0 0 1-1.65-.61 12.9 12.9 0 0 1-4.94-4.37c-.37-.5-.94-1.33-.94-2.54s.63-1.8.86-2.05a.9.9 0 0 1 .65-.3h.47c.15 0 .35-.06.55.42.2.5.69 1.7.75 1.83.06.12.1.27.02.43-.08.17-.12.27-.25.41l-.37.43c-.12.12-.25.26-.11.5.15.25.65 1.07 1.4 1.73.96.85 1.77 1.12 2.02 1.24.25.13.4.1.54-.06.15-.17.62-.72.78-.97.17-.25.33-.2.56-.12.23.08 1.45.68 1.7.81.25.12.41.18.47.29.06.1.06.6-.17 1.27z" />
                    </svg>
                    WhatsApp
                  </a>
                ) : (
                  <span className="yuk-yesil opacity-40">WhatsApp</span>
                )}
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {iletisimVar ? (
                  <BilgiSorButonu ilanId={ilan.id} gonderenUserId={ilan.gonderenUserId} telefon={ilan.telefon} etiket="Bilgi sor" sinif="yuk-ikincil yuk-ikincil-soru w-full disabled:opacity-50" />
                ) : (
                  <span className="yuk-ikincil opacity-40">Bilgi sor</span>
                )}
                <button type="button" disabled={bekliyor || takipte} onClick={() => durumYap("ILGILENIYOR")} className="yuk-ikincil disabled:opacity-60">
                  <Ik ad="isaret" />
                  {takipte ? "Takipte" : "Takibe al"}
                </button>
                <button type="button" disabled={islem} onClick={seferimeEkle} className="yuk-ikincil disabled:opacity-60">
                  <Ik ad="arti" />
                  {islem ? "Açılıyor…" : "Seferime ekle"}
                </button>
              </div>

              {maliyetSatirlari.length > 0 && (
                <section className="yuk-maliyet mt-4">
                  <button type="button" onClick={() => setMaliyetAcik((v) => !v)} aria-expanded={maliyetAcik} className="flex w-full items-center justify-between gap-2 text-left">
                    <span>
                      <span className="block text-[16px] font-extrabold">Maliyet tahmini</span>
                      <span className="block text-[12px] text-[var(--a-ikincil)]">Mesafe, yakıt ve yol gideri (tahmini)</span>
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={`h-5 w-5 transition-transform duration-200 ${maliyetAcik ? "rotate-180" : ""}`} aria-hidden>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {maliyetAcik && (
                      <m.ul
                        key="m"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 40 }}
                        className="overflow-hidden"
                      >
                        {maliyetSatirlari.map(([ad, deger], i) => (
                          <li
                            key={ad}
                            className={`flex items-center justify-between gap-3 border-t border-[var(--a-cizgi)] py-2 text-[13.5px] ${i === maliyetSatirlari.length - 1 && ad === "Tahmini net kalan" ? "font-bold" : ""}`}
                          >
                            <span className="text-[#3b4262]">{ad}</span>
                            <span className={`font-semibold tabular-nums ${ad === "Tahmini net kalan" ? (kar?.netPozitif === false ? "text-[#ef4444]" : "text-[#16a34a]") : ""}`}>{deger}</span>
                          </li>
                        ))}
                      </m.ul>
                    )}
                  </AnimatePresence>
                </section>
              )}

              {uyarilar.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-2xl bg-[#fff7ed] px-4 py-3 text-[13px] font-medium text-[#9a3412]">
                  {uyarilar.map((u) => (
                    <li key={u}>• {u}</li>
                  ))}
                </ul>
              )}

              {ilan.waNot && <p className="mt-3 rounded-2xl bg-[#f3f5fb] px-4 py-3 text-[13px] text-[#3b4262]">{ilan.waNot}</p>}

              <p className="mt-3 flex items-start gap-2.5 rounded-2xl bg-[#eef1fd] px-4 py-3 text-[13px] text-[#3b4262]">
                <span className="mt-0.5 text-[var(--a-indigo)]" aria-hidden>
                  ⓘ
                </span>
                <span>
                  <b className="block text-[var(--a-murekkep)]">Bilgileri yük sahibiyle teyit et.</b>
                  Navlun, yükleme zamanı ve detaylar için yük sahibi ile görüşün.
                </span>
              </p>

              {ilan.donusOnerileri && ilan.donusOnerileri.length > 0 && (
                <p className="mt-3 text-[13px]">
                  Dönüş:{" "}
                  <Link href={`/ai/yukler?sekme=HEPSI&id=${ilan.donusOnerileri[0].id}`} className="font-semibold text-[var(--a-indigo)]">
                    {ilan.donusOnerileri[0].rota}
                  </Link>
                </p>
              )}

              <div className="mt-4">
                <button type="button" onClick={() => setMetinAcik((v) => !v)} aria-expanded={metinAcik} className="ana-link">
                  {metinAcik ? "İlan metnini gizle" : "İlan metnini göster"}
                </button>
                {metinAcik && (
                  <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-[#f6f7fb] px-4 py-3 text-[13px] leading-relaxed text-[#3b4262]">
                    {ilan.hamMetin}
                    {ilan.kaynakAd && <span className="mt-2 block text-[11.5px] text-[var(--a-ikincil)]">Kaynak: {ilan.kaynakAd}</span>}
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--a-cizgi)] pt-4">
                {ilan.durum !== "ALINDI" && (
                  <button type="button" disabled={bekliyor} onClick={() => durumYap("ALINDI")} className="ana-hap">
                    ✓ Yükü aldım
                  </button>
                )}
                {ilan.durum !== "ELENDI" && (
                  <button type="button" disabled={bekliyor} onClick={() => { durumYap("ELENDI"); kapat(); }} className="ana-hap">
                    Geç
                  </button>
                )}
                {ilan.telefon && (
                  <button
                    type="button"
                    disabled={islem}
                    onClick={() => {
                      if (!window.confirm(`${ilan.telefon} yanlış numara olarak işaretlensin mi? Bu numaralı ilanlar bir daha gelmez.`)) return;
                      baslatIslem(async () => {
                        await ilanYanlisNumara(ilan.id);
                        kapat();
                        router.refresh();
                      });
                    }}
                    className="ana-hap"
                  >
                    Yanlış numara
                  </button>
                )}
                <button
                  type="button"
                  disabled={islem}
                  onClick={() => {
                    if (!window.confirm("Bu ilanı silmek istediğine emin misin?")) return;
                    baslatIslem(async () => {
                      await ilanSil(ilan.id);
                      kapat();
                      router.refresh();
                    });
                  }}
                  className="ana-hap !text-[#dc2626]"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
