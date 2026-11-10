import Link from "next/link";
import type { ReactNode } from "react";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { DonemGecis, YatayCubuk } from "@/components/finans/RaporGrafik";
import RaporUst, { type Donem } from "@/components/finans/RaporUst";
import FirmaAvatar from "@/components/kasa/FirmaAvatar";
import { tlYazKisa } from "@/lib/para";

export type RaporVeri = {
  donem: Donem;
  /** Dönem anahtarı (geçiş animasyonu için) */
  anahtar: string;
  /** KDV hariç */
  gelirNet: number;
  /** İşletme giderleri (demirbaş hariç), KDV hariç */
  giderNet: number;
  /** KDV dahil */
  gelirToplam: number;
  giderToplam: number;
  yukAdet: number;
  giderAdet: number;
  hesaplananKdv: number;
  indirilecekKdv: number;
  /** Tüm gider türleri (demirbaş dahil), KDV dahil */
  kategoriler: { kod: string; ad: string; tutar: number }[];
  /** KDV dahil sefer tutarı */
  firmalar: { id: number; ad: string; tutar: number; adet: number }[];
  /** Tır bazlı (KDV hariç; gider = işletme gideri) */
  araclar?: { id: number; etiket: string; sofor: string | null; gelir: number; gider: number; sefer: number }[];
  excelHref: string;
};

const KAT_IKON: Record<string, ReactNode> = {
  YAKIT: <path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M4 20h12M8 9h4M15 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3" />,
  BAKIM: <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
  TAMIR: <path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
  LASTIK: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};
const DIGER_IKON = (
  <>
    <circle cx="6" cy="12" r="1.3" />
    <circle cx="12" cy="12" r="1.3" />
    <circle cx="18" cy="12" r="1.3" />
  </>
);

function MiniIkon({ children, ton }: { children: ReactNode; ton: string }) {
  return (
    <span className={`ana-mini-ikon rp-ikon ${ton}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

export function ExcelIkon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

/** Aylık işletme raporu (veri dışarıdan; yerel önizleme örnek veriyle kullanır). */
export default function RaporGorunum({ v }: { v: RaporVeri }) {
  const netKar = v.gelirNet - v.giderNet;
  const kdvFarki = v.hesaplananKdv - v.indirilecekKdv;
  const enBuyukKat = Math.max(1, ...v.kategoriler.map((k) => k.tutar));
  const ozet = [
    { ad: "Net gelir", alt: `${v.yukAdet} sefer · KDV dahil ${tlYazKisa(v.gelirToplam)}`, tutar: v.gelirNet, ikon: <path d="M4 16l5-5 4 4 7-7M15 8h5v5" />, ton: "ana-ton-yesil", href: "/yukler" },
    {
      ad: "Net gider",
      alt: `İşletme giderleri · KDV dahil ${tlYazKisa(v.giderToplam)}`,
      tutar: v.giderNet,
      ikon: <path d="M4 8l5 5 4-4 7 7M15 16h5v-5" />,
      ton: "ana-ton-kirmizi",
      href: "/giderler",
    },
  ];

  return (
    <div className={`ana rp-genis ${anaYazi.variable}`}>
      <HareketKok>
        <RaporUst geriHref="/ozet" donem={v.donem}>
          <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Raporlar</h1>
          <p className="text-[14px] font-medium text-[#c7cffd]">Aylık işletme raporu</p>
        </RaporUst>

        <DonemGecis key={v.anahtar} className="ana-ic relative z-10 -mt-10 space-y-6 pb-8">
          <div className="rp-izgara">
          <div className="space-y-6">
          <section className="rp-kart px-3 py-1.5" aria-label="Dönem sonucu">
            <ul>
              {ozet.map((o) => (
                <li key={o.ad} className="border-b border-[var(--a-cizgi)]">
                  <Link href={o.href} className="rp-satir">
                    <MiniIkon ton={o.ton}>{o.ikon}</MiniIkon>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{o.ad}</span>
                      <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">{o.alt}</span>
                    </span>
                    <span className="shrink-0 text-[16px] font-extrabold tabular-nums">{tlYazKisa(o.tutar)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="rp-vurgu my-1.5">
              <MiniIkon ton="ana-ton-indigo">
                <path d="M6 20v-6M12 20V9M18 20V4" />
              </MiniIkon>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold">Net sonuç</span>
                <span className="block text-[11.5px] text-[var(--a-ikincil)]">KDV hariç · demirbaş hariç</span>
              </span>
              <span className={`ana-tutar shrink-0 text-[1.35rem] font-extrabold tabular-nums ${netKar < 0 ? "text-[#dc2626]" : "text-[#4338ca]"}`}>{tlYazKisa(netKar)}</span>
            </div>
          </section>

          <section aria-labelledby="gelir-gider">
            <div className="flex items-baseline gap-2 px-1">
              <h2 id="gelir-gider" className="ana-baslik">
                Gelir ve gider
              </h2>
              <span className="text-[13px] font-semibold text-[var(--a-ikincil)]">· KDV dahil</span>
            </div>
            <ul className="rp-kart mt-2 space-y-3 px-4 py-4">
              {[
                { ad: "Gelir", tutar: v.gelirToplam, renk: "bg-gradient-to-r from-[#86efac] to-[#16a34a]" },
                { ad: "Gider", tutar: v.giderToplam, renk: "bg-gradient-to-r from-[#fb7185] to-[#ef4444]" },
              ].map((s, i) => (
                <li key={s.ad} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-[13.5px] font-semibold">{s.ad}</span>
                  <YatayCubuk oran={s.tutar / Math.max(1, v.gelirToplam, v.giderToplam)} renk={s.renk} gecikme={i * 0.06} />
                  <span className="w-[5.6rem] shrink-0 text-right text-[14px] font-extrabold tabular-nums">{tlYazKisa(s.tutar)}</span>
                </li>
              ))}
            </ul>
          </section>
          </div>
          <div className="space-y-6">
          <section aria-labelledby="gider-dagilimi">
            <div className="flex items-baseline gap-2 px-1">
              <h2 id="gider-dagilimi" className="ana-baslik">
                Gider dağılımı
              </h2>
              <span className="text-[13px] font-semibold text-[var(--a-ikincil)]">· KDV dahil, tüm türler</span>
            </div>
            {v.kategoriler.length === 0 ? (
              <p className="rp-bos mt-2">Bu ay gider yok.</p>
            ) : (
              <ul className="mt-2">
                {v.kategoriler.map((k, i) => (
                  <li key={k.kod} className="flex items-center gap-2.5 border-b border-[var(--a-cizgi)] py-2 last:border-0">
                    <MiniIkon ton={k.kod === "YAKIT" ? "ana-ton-turuncu" : k.kod === "DEMIRBAS" ? "ana-ton-gri" : "ana-ton-indigo"}>{KAT_IKON[k.kod] ?? DIGER_IKON}</MiniIkon>
                    <span className="w-[6.4rem] shrink-0 truncate text-[13.5px] font-semibold">{k.ad}</span>
                    <YatayCubuk oran={k.tutar / enBuyukKat} renk="bg-gradient-to-r from-[#fb7185] to-[#ef4444]" gecikme={i * 0.04} />
                    <span className="w-[5.4rem] shrink-0 text-right text-[14px] font-extrabold tabular-nums">{tlYazKisa(k.tutar)}</span>
                  </li>
                ))}
              </ul>
            )}
            {v.kategoriler.some((k) => k.kod === "DEMIRBAS") && <p className="rp-not mt-1.5">Demirbaş bu listede görünür, net gidere ve net sonuca katılmaz.</p>}
          </section>

          <section aria-labelledby="firma-geliri">
            <div className="flex items-baseline gap-2 px-1">
              <h2 id="firma-geliri" className="ana-baslik">
                Firma bazlı gelir
              </h2>
              <span className="text-[13px] font-semibold text-[var(--a-ikincil)]">· KDV dahil</span>
            </div>
            {v.firmalar.length === 0 ? (
              <p className="rp-bos mt-2">Bu ay sefer yok.</p>
            ) : (
              <ul className="mt-1">
                {v.firmalar.map((f) => (
                  <li key={f.id} className="border-b border-[var(--a-cizgi)] last:border-0">
                    <Link href={`/firmalar/${f.id}`} className="rp-satir">
                      <FirmaAvatar id={f.id} ad={f.ad} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">{f.ad}</span>
                        <span className="block text-[11.5px] text-[var(--a-ikincil)]">{f.adet} sefer</span>
                      </span>
                      <span className="shrink-0 text-[15.5px] font-extrabold tabular-nums">{tlYazKisa(f.tutar)}</span>
                      <span className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {v.araclar && v.araclar.length > 0 && (
            <section aria-labelledby="tir-bazli">
              <div className="flex items-baseline gap-2 px-1">
                <h2 id="tir-bazli" className="ana-baslik">
                  Tır bazlı gelir / gider
                </h2>
                <span className="text-[13px] font-semibold text-[var(--a-ikincil)]">· KDV hariç</span>
              </div>
              <ul className="mt-1">
                {[...v.araclar, { id: 0, etiket: "Toplam", sofor: null, gelir: v.gelirNet, gider: v.giderNet, sefer: v.yukAdet }].map((a) => {
                  const net = a.gelir - a.gider;
                  return (
                    <li key={a.id} className={`border-b border-[var(--a-cizgi)] py-2.5 last:border-0 ${a.id === 0 ? "font-extrabold" : ""}`}>
                      <div className="flex items-baseline justify-between gap-2 px-1">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-bold">{a.etiket}</span>
                          <span className="block text-[11.5px] text-[var(--a-ikincil)]">
                            {[a.sofor, `${a.sefer} sefer`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className={`shrink-0 text-[15.5px] font-extrabold tabular-nums ${net < 0 ? "text-[#dc2626]" : "text-[#15803d]"}`}>
                          {tlYazKisa(net)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex gap-4 px-1 text-[12.5px] tabular-nums text-[var(--a-ikincil)]">
                        <span>Gelir {tlYazKisa(a.gelir)}</span>
                        <span>Gider {tlYazKisa(a.gider)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="rp-not mt-1.5">Tır seçilmeden girilmiş eski kayıtlar ilk tıra yazılır.</p>
            </section>
          )}

          </div>
          </div>

          <section aria-labelledby="kdv-ozet">
            <Link href={`/kdv?ay=${v.anahtar}`} className="rp-genis-dugme">
              <MiniIkon ton="ana-ton-indigo">
                <path d="M7 17L17 7M8 8.5h.01M16 15.5h.01" />
              </MiniIkon>
              <span className="min-w-0 flex-1">
                <span id="kdv-ozet" className="block text-[14.5px] font-extrabold text-[#3730a3]">
                  KDV farkı {tlYazKisa(kdvFarki)}
                </span>
                <span className="block truncate text-[11.5px] text-[var(--a-ikincil)]">
                  Hesaplanan {tlYazKisa(v.hesaplananKdv)} − indirilecek {tlYazKisa(v.indirilecekKdv)}
                </span>
              </span>
              <span className="shrink-0 text-[20px] leading-none text-[var(--a-ikincil)]" aria-hidden>
                ›
              </span>
            </Link>
          </section>

          <a href={v.excelHref} className="ana-ana-dugme w-full gap-2 !min-h-[3.3rem] !text-[1rem]">
            <ExcelIkon />
            Excel indir
          </a>
        </DonemGecis>
      </HareketKok>
    </div>
  );
}
