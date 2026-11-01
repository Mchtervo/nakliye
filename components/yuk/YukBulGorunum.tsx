import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { donusTalebiKapat, simdiTara, eskiIlanlariTemizle } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import BildirimZili from "@/components/BildirimZili";
import YonSecici from "@/components/YonSecici";
import YolculukFormu from "@/components/YolculukFormu";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import AramaTepsisi, { type RotaCip, type SekmeOge } from "@/components/yuk/AramaTepsisi";
import RotaCizgi from "@/components/yuk/RotaCizgi";
import YukListe from "@/components/yuk/YukListe";
import type { IlanKartVeri } from "@/components/yuk/YukKart";
import { ILLER } from "@/lib/iller";

export type DonusYolculuk = { id: number; cikis: string; varis: string; cikisIl: string; cevre: string[] };

export type YukBulVeri = {
  sekme: string;
  nereden: string;
  nereye: string;
  cipler: RotaCip[];
  sekmeler: SekmeOge[];
  konum: string | null;
  yonler: string[];
  yonCevreleri: Record<string, string[]>;
  /** Yeni sekmesi konuma göre süzülüyor mu; link açıp kapatır */
  konumFiltresi: boolean;
  konumLink: string;
  /** "Tenteli/Kapalı kasa · ≤26t" */
  aracFiltreYazi: string;
  yonSeciciGoster: boolean;
  durumSatiri: string;
  bildirimler: ReactNode;
  ilanlar: IlanKartVeri[];
  supheli: { sayi: number; href: string };
  bosMesaj: string;
  filtreKaldirHref: string | null;
  filtreOzet: string | null;
  yerHatasi: string | null;
  arsiv: { goster: boolean; href: string };
  /** Üye görünümü: yöneticiye özel düğmeler (arşiv, toplu silme) gizlenir */
  uye?: boolean;
  yolculuk: DonusYolculuk | null;
};

function Baslik({ v }: { v: YukBulVeri }) {
  const takip = v.sekme === "ILGILENIYOR";
  const donus = v.sekme === "DONUS";
  const baslik = takip ? "Takibindeki ilanlar" : donus ? "Dönüş yükü" : "Yük bul";
  const alt = takip ? "İlgilendiğin yükleri kolayca takip et" : donus ? "Boş döneceğin yerde yük ara" : "Aracına uygun yükleri keşfet";

  return (
    <header className="ana-ust yuk-ust">
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
          <div className="flex items-center gap-2">
            <AksiyonButonu calistir={simdiTara} etiket="Yenile" bekleyenEtiket="Taranıyor…" sinif="ana-cam-dugme !min-h-9 !px-3.5 !text-[13px]" />
            <BildirimZili tema="cam" />
          </div>
        </div>

        <div className="ana-gir relative mt-3" style={{ animationDelay: "40ms" }}>
          <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white">{baslik}</h1>
          <p className="text-[14px] text-[#b8c1f5]">{alt}</p>
          {!takip && !donus && <p className="mt-0.5 text-[12.5px] font-semibold text-[#7ef0a8]">{v.durumSatiri}</p>}
          {donus && v.yolculuk && (
            <span className="yuk-aktif absolute right-0 top-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e] shadow-[0_0_10px_#22c55e]" aria-hidden />
              Aktif arama
            </span>
          )}
          {takip && (
            <span className="yuk-yer-imi" aria-hidden>
              <svg viewBox="0 0 64 80">
                <defs>
                  <linearGradient id="yi" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#a5b8ff" />
                    <stop offset="1" stopColor="#4f5fe8" />
                  </linearGradient>
                </defs>
                <rect x="6" y="6" width="52" height="68" rx="12" fill="#2b3aa8" opacity=".55" />
                <path d="M14 4h36a6 6 0 0 1 6 6v64L32 60 8 74V10a6 6 0 0 1 6-6z" fill="url(#yi)" />
                <path d="M22 4h20v14H22z" fill="#c9d5ff" opacity=".7" />
              </svg>
            </span>
          )}
        </div>

        {!takip && (
          <div className="ana-gir mt-1" style={{ animationDelay: "60ms" }}>
            {donus ? (
              v.yolculuk ? <RotaCizgi sol={v.yolculuk.cikis} sag={v.yolculuk.varis} /> : <div className="h-6" />
            ) : (
              <>
                <RotaCizgi sol={v.konum} sag={v.yonler.length ? v.yonler[0] + (v.yonler.length > 1 ? ` +${v.yonler.length - 1}` : "") : null} />
                <Link href={v.konumLink} className="yuk-aracim">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#c7d2ff]" aria-hidden>
                    <path d="M2 7.5A1.5 1.5 0 0 1 3.5 6h9A1.5 1.5 0 0 1 14 7.5V16H2z" />
                    <path d="M14 10h3.6a1.5 1.5 0 0 1 1.2.6l2.2 2.9V16h-7z" />
                    <circle cx="6" cy="17" r="2" />
                    <circle cx="17.5" cy="17" r="2" />
                  </svg>
                  <span className="truncate">
                    {v.konum ? `Aracım: ${v.konum}` : "Konum yok"}
                    <span className="ml-1.5 font-medium text-[#a9b5f5]">· {v.konumFiltresi ? "tümünü göster" : "çevreye süz"}</span>
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function DonusPaneli({ y }: { y: DonusYolculuk | null }) {
  if (!y) {
    return (
      <div className="space-y-2">
        <p className="text-[14px] font-bold">Aktif dönüş araması yok</p>
        <p className="text-[12.5px] text-[var(--a-ikincil)]">Yola çıkınca yeni yolculuk başlat; vardığın yerde ve 60 km çevresinde dönüş yükü aranır.</p>
        <YolculukFormu tema="acik" ilkAcik={false} acmaEtiketi="+ Yeni yolculuk" />
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-stretch gap-1.5">
        <div className="yuk-alan">
          <span className="text-[#4f6bff]" aria-hidden>●</span>
          <span className="min-w-0">
            <span className="yuk-alan-etiket">Arama çıkışı</span>
            <span className="block truncate text-[15px] font-bold">{y.cikisIl}</span>
          </span>
        </div>
        <span className="yuk-degistir pointer-events-none opacity-70" aria-hidden>
          →
        </span>
        <div className="yuk-alan">
          <span className="text-[#8b5cf6]" aria-hidden>●</span>
          <span className="min-w-0">
            <span className="yuk-alan-etiket">Öncelikli yön</span>
            <span className="block truncate text-[15px] font-bold">{y.varis}</span>
          </span>
        </div>
      </div>
      <p className="mt-2 flex items-start gap-2 rounded-xl bg-[#f3f5fb] px-3 py-2 text-[12px] text-[#3b4262]">
        <span className="text-[var(--a-indigo)]" aria-hidden>
          ⓘ
        </span>
        {y.cikisIl}
        {y.cevre.length ? " ve 60 km çevresinden" : " ilinden"} çıkan yükler aranır; {y.varis} yönüne dönenler önce gelir.
      </p>
    </div>
  );
}

/** Yük bul sayfası görünümü (veri dışarıdan; yerel önizleme örnek veriyle kullanır). */
export default function YukBulGorunum({ v }: { v: YukBulVeri }) {
  const donus = v.sekme === "DONUS";
  const takip = v.sekme === "ILGILENIYOR";
  const gorunum = takip ? "takip" : donus ? "donus" : "liste";

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <Baslik v={v} />

        <div className="ana-ic relative z-10">
          <AramaTepsisi
            sekme={v.sekme}
            nereden={v.nereden}
            nereye={v.nereye}
            cipler={v.cipler}
            sekmeler={v.sekmeler}
            ust={donus ? <DonusPaneli y={v.yolculuk} /> : undefined}
            alanlar={!takip}
          />

          <div className="mt-4 space-y-3">
            {v.bildirimler}

            {v.yonSeciciGoster && (
              <section className="ana-yon ana-gir !mt-3" style={{ animationDelay: "120ms" }}>
                <YonSecici yonler={v.yonler} iller={ILLER} cevreler={v.yonCevreleri} tema="acik" />
              </section>
            )}

            {v.yerHatasi && <p className="text-[12.5px] font-semibold text-[#dc2626]">{v.yerHatasi}</p>}

            <div className="flex items-center justify-between gap-3 px-1 pt-1">
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-[#3b4262]">
                  {donus ? `${v.ilanlar.length} dönüş yükü bulundu` : takip ? `${v.ilanlar.length} ilan takipte` : `${v.ilanlar.length} yük bulundu`}
                </p>
                {v.filtreOzet && <p className="truncate text-[11.5px] text-[var(--a-ikincil)]">Filtre: {v.filtreOzet}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {v.supheli.sayi > 0 && v.sekme !== "SUPHELI" && (
                  <Link href={v.supheli.href} className="ana-hap !min-h-9 !text-[12px]">
                    Şüpheli <span className="text-[#ea580c]">{v.supheli.sayi}</span>
                  </Link>
                )}
                <Link href="/ayarlar#ai" className="ana-hap !min-h-9 !text-[12.5px]" title={v.aracFiltreYazi}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-4 w-4 text-[var(--a-indigo)]" aria-hidden>
                    <path d="M4 7h16M7 12h10M10 17h4" />
                  </svg>
                  Filtreler
                </Link>
              </div>
            </div>

            {v.ilanlar.length === 0 ? (
              <div className="rounded-[1.4rem] bg-white px-5 py-8 text-center shadow-[var(--a-golge)]">
                <p className="text-[14.5px] font-semibold text-[#3b4262]">{v.bosMesaj}</p>
                {v.filtreKaldirHref && (
                  <Link href={v.filtreKaldirHref} className="ana-link mt-2 inline-block">
                    Filtreyi kaldır · tüm ilanlar
                  </Link>
                )}
              </div>
            ) : (
              <YukListe ilanlar={v.ilanlar} gorunum={gorunum} />
            )}

            {donus && v.yolculuk && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <AksiyonButonu
                    calistir={donusTalebiKapat.bind(null, v.yolculuk.id)}
                    etiket="⏸  Aramayı durdur"
                    bekleyenEtiket="Durduruluyor…"
                    sinif="yuk-durdur"
                  />
                  <YolculukFormu tema="acik" ilkAcik={false} acmaEtiketi="+ Yeni yolculuk" />
                </div>
                <p className="flex items-start gap-3 rounded-[1.2rem] bg-white px-4 py-3 text-[12.5px] text-[var(--a-ikincil)] shadow-[var(--a-golge)]">
                  <span className="text-[18px] text-[var(--a-indigo)]" aria-hidden>
                    ⌖
                  </span>
                  <span>
                    <b className="block text-[13.5px] text-[var(--a-murekkep)]">Konum elle güncellenir.</b>
                    Daha doğru sonuçlar için bulunduğun konumu güncel tut (Yolculuk / Eve döndüm).
                  </span>
                </p>
              </div>
            )}

            {!v.uye && (
            <div className="flex items-center justify-center gap-4 pb-4 pt-2 text-[12.5px] font-semibold">
              <Link href={v.arsiv.href} className={v.arsiv.goster ? "text-[var(--a-indigo)]" : "text-[var(--a-ikincil)]"}>
                {v.arsiv.goster ? "Arşivi gizle" : "Arşivi göster"}
              </Link>
              {v.ilanlar.length > 0 && (
                <AksiyonButonu
                  calistir={eskiIlanlariTemizle}
                  etiket="6 saati geçenleri sil"
                  bekleyenEtiket="…"
                  onay="6 saattir yenilenmeyen ilanlar silinsin mi?"
                  sinif="text-[12.5px] font-semibold text-[var(--a-ikincil)]"
                />
              )}
            </div>
            )}
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
