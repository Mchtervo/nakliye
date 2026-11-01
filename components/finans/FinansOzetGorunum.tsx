import Link from "next/link";
import type { ReactNode } from "react";
import AraButonu from "@/components/AraButonu";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { AySutunlari, type SutunVeri } from "@/components/finans/RaporGrafik";
import RaporUst from "@/components/finans/RaporUst";
import { tlYazKisa } from "@/lib/para";
import { telefonGoster } from "@/lib/telefon";

export type OzetVeri = {
  ayEtiket: string;
  /** KDV hariç, bu ay (seferler / işletme giderleri — demirbaş hariç) */
  netGelir: number;
  netGider: number;
  sonuc: number;
  /** Geçen ayın işletme sonucu (yüzde için) */
  gecenSonuc: number;
  /** KDV dahil aynı tutarlar (bilgi) */
  gelirKdvli: number;
  giderKdvli: number;
  aylar: SutunVeri[];
  /** Bu ayki seferlerin tahsil edilen kısmı / toplamı (KDV dahil) */
  tahsil: number;
  tahsilToplam: number;
  /** Tüm açık alacak (KDV dahil) */
  alacak: number;
  alacakFirma: number;
  kasa: number;
  bugune: { gelir: number; gider: number; kdv: number };
  excelHref: string;
  hizliAraTel: string;
  muhasebeciTel: string;
  /** Üye hesabı: Ayarlar sayfası kapalı */
  uye?: boolean;
};

const IKON = {
  gelir: <path d="M4 16l5-5 4 4 7-7M15 8h5v5" />,
  gider: <path d="M4 8l5 5 4-4 7 7M15 16h5v-5" />,
  tahsil: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  alacak: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  kasa: (
    <>
      <path d="M4 8a2 2 0 0 1 2-2h12v3h1a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M16 13.5h2" />
    </>
  ),
  rapor: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 8.5h6M9 12.5h6M9 16.5h4" />
    </>
  ),
};

function Ikon({ children, ton }: { children: ReactNode; ton: string }) {
  return (
    <span className={`ana-mini-ikon rp-ikon ${ton}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function Ok() {
  return (
    <span className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
      ›
    </span>
  );
}

/** Geçen aya göre değişim; geçen ay ≤0 ise oran anlamsız. */
function degisim(simdi: number, onceki: number): number | null {
  if (onceki <= 0) return null;
  return Math.round(((simdi - onceki) / onceki) * 100);
}

/** Finans özeti (veri dışarıdan; yerel önizleme örnek veriyle kullanır). */
export default function FinansOzetGorunum({ v }: { v: OzetVeri }) {
  const yuzde = degisim(v.sonuc, v.gecenSonuc);
  const nakit = [
    {
      ad: "Tahsil",
      alt: v.tahsilToplam > 0 ? `Bu ayın seferlerinden · ${tlYazKisa(v.tahsilToplam)} içinde` : "Bu ay sefer yok",
      tutar: v.tahsil,
      ikon: IKON.tahsil,
      ton: "ana-ton-yesil",
      href: "/yukler",
    },
    {
      ad: "Alacak",
      alt: v.alacakFirma > 0 ? `Tüm açık hesaplar · ${v.alacakFirma} firma` : "Açık alacak yok",
      tutar: v.alacak,
      ikon: IKON.alacak,
      ton: "ana-ton-turuncu",
      href: "/para?sekme=cari",
    },
    { ad: "Kasa", alt: "Kasadaki nakit (bugün)", tutar: v.kasa, ikon: IKON.kasa, ton: "ana-ton-indigo", href: "/para?sekme=kasa" },
  ];

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <RaporUst gorsel={{ src: "/ana/ozet-grafik.png", genislik: 150 }}>
          <div className="max-w-[64%]">
            <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Finans özeti</h1>
            <p className="text-[13.5px] capitalize text-[#c7cffd]">{v.ayEtiket}</p>
            <p className="mt-3 text-[14px] font-semibold text-[#dfe4ff]">KDV hariç işletme sonucu</p>
          </div>
          <p className={`ana-tutar mt-0.5 text-[2.5rem] font-extrabold leading-none tracking-[-0.035em] ${v.sonuc < 0 ? "text-[#fca5a5]" : "text-white"}`}>{tlYazKisa(v.sonuc)}</p>
          <p className="mt-1.5 text-[12px] font-medium text-[#9aa6e8]">
            Seferler − işletme giderleri · demirbaş hariç
            {yuzde !== null && (
              <span className={`ml-2 whitespace-nowrap font-bold ${yuzde >= 0 ? "text-[#7ef0a8]" : "text-[#ffb4b4]"}`}>
                {yuzde >= 0 ? "↑" : "↓"} %{Math.abs(yuzde)} geçen aya göre
              </span>
            )}
          </p>
        </RaporUst>

        <div className="ana-ic relative z-10 -mt-12 space-y-6 pb-8">
          <section className="rp-kart ana-gir grid grid-cols-2 p-2" style={{ animationDelay: "90ms" }} aria-label="Bu ayın geliri ve gideri">
            <Link href="/yukler" className="rp-hucre">
              <Ikon ton="ana-ton-yesil">{IKON.gelir}</Ikon>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-[var(--a-ikincil)]">Net gelir</span>
                <span className="block truncate text-[1.15rem] font-extrabold tabular-nums">{tlYazKisa(v.netGelir)}</span>
              </span>
            </Link>
            <Link href="/giderler" className="rp-hucre border-l border-[var(--a-cizgi)]">
              <Ikon ton="ana-ton-kirmizi">{IKON.gider}</Ikon>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-[var(--a-ikincil)]">Net gider</span>
                <span className="block truncate text-[1.15rem] font-extrabold tabular-nums">{tlYazKisa(v.netGider)}</span>
              </span>
            </Link>
            <p className="col-span-2 px-2 pb-1 pt-1.5 text-center text-[11.5px] text-[var(--a-ikincil)]">
              KDV hariç · KDV dahil: gelir <b className="tabular-nums">{tlYazKisa(v.gelirKdvli)}</b>, gider <b className="tabular-nums">{tlYazKisa(v.giderKdvli)}</b>
            </p>
          </section>

          <section className="ana-gir" style={{ animationDelay: "140ms" }} aria-labelledby="aylik-sonuc">
            <div className="flex items-baseline justify-between px-1">
              <h2 id="aylik-sonuc" className="ana-baslik">
                Aylık işletme sonucu
              </h2>
              <span className="text-[12px] font-semibold text-[#4f46e5]">bin TL</span>
            </div>
            <div className="mt-3 px-1">
              <AySutunlari veri={v.aylar} etiket="Son 6 ayın KDV hariç işletme sonucu" />
            </div>
          </section>

          <section className="ana-gir" style={{ animationDelay: "190ms" }} aria-labelledby="nakit-durumu">
            <h2 id="nakit-durumu" className="ana-baslik px-1">
              Nakit durumu
            </h2>
            <ul className="rp-kart mt-2 px-3">
              {nakit.map((n) => (
                <li key={n.ad} className="border-b border-[var(--a-cizgi)] last:border-0">
                  <Link href={n.href} className="rp-satir">
                    <Ikon ton={n.ton}>{n.ikon}</Ikon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{n.ad}</span>
                      <span className="block truncate text-[12px] text-[var(--a-ikincil)]">{n.alt}</span>
                    </span>
                    <span className={`shrink-0 text-[15.5px] font-extrabold tabular-nums ${n.tutar < 0 ? "text-[#dc2626]" : ""}`}>{tlYazKisa(n.tutar)}</span>
                    <Ok />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="rp-not mt-2.5">
              <span aria-hidden>ⓘ</span>
              <span>
                İşletme sonucu ve nakit farklıdır: tahsil, alacak ve kasa KDV dahil para hareketidir, sonuca eklenmez. Ana sayfadaki “net kalan” da ayrı hesaptır
                (KDV dahil, kredi ve kart ödemeleri düşülür).
              </span>
            </p>
          </section>

          <section className="ana-gir space-y-2.5" style={{ animationDelay: "230ms" }}>
            <Link href="/raporlar" className="rp-genis-dugme">
              <Ikon ton="ana-ton-indigo">{IKON.rapor}</Ikon>
              <span className="flex-1 text-[15.5px] font-extrabold text-[#3730a3]">Raporları aç</span>
              <Ok />
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link href="/kdv" className="ana-hap">
                KDV Merkezi
              </Link>
              <Link href="/muhasebeci" className="ana-hap">
                Muhasebeciye gönder
              </Link>
              <a href={v.excelHref} className="ana-hap">
                Bu ayın Excel’i
              </a>
            </div>
          </section>

          <section className="ana-gir" style={{ animationDelay: "260ms" }} aria-labelledby="bugune-kadar">
            <h2 id="bugune-kadar" className="ana-baslik px-1">
              Bugüne kadar <span className="text-[13px] font-semibold text-[var(--a-ikincil)]">· KDV dahil</span>
            </h2>
            <div className="mt-2 grid grid-cols-3 divide-x divide-[var(--a-cizgi)] rounded-[1.3rem] bg-white py-3 shadow-[var(--a-golge)]">
              {[
                { ad: "Gelir", t: v.bugune.gelir, href: "/yukler", s: "" },
                { ad: "Gider", t: v.bugune.gider, href: "/giderler", s: "text-[#dc2626]" },
                { ad: "KDV farkı", t: v.bugune.kdv, href: "/kdv", s: "text-[#4f46e5]" },
              ].map((b) => (
                <Link key={b.ad} href={b.href} className="min-w-0 px-3">
                  <span className="block text-[11.5px] font-semibold text-[var(--a-ikincil)]">{b.ad}</span>
                  <span className={`block truncate text-[15px] font-extrabold tabular-nums ${b.s}`}>{tlYazKisa(b.t)}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="ana-gir" style={{ animationDelay: "290ms" }} aria-labelledby="hizli-ara">
            <div className="flex items-baseline justify-between px-1">
              <h2 id="hizli-ara" className="ana-baslik">
                Hızlı ara
              </h2>
              {!v.uye && (
                <Link href="/ayarlar" className="ana-link text-[13px]">
                  Ayarla
                </Link>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {v.hizliAraTel ? (
                <AraButonu telefon={v.hizliAraTel} etiket={telefonGoster(v.hizliAraTel)} className="ana-hap" />
              ) : v.uye ? (
                <span className="text-[13px] text-[var(--a-ikincil)]">Kayıtlı numara yok.</span>
              ) : (
                <Link href="/ayarlar" className="ana-hap">
                  Numara kaydet
                </Link>
              )}
              {v.muhasebeciTel && <AraButonu telefon={v.muhasebeciTel} etiket={`Muhasebeci · ${telefonGoster(v.muhasebeciTel)}`} className="ana-hap" />}
            </div>
          </section>
        </div>
      </HareketKok>
    </div>
  );
}
