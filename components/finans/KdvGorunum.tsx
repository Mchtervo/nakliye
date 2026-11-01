import Link from "next/link";
import type { ReactNode } from "react";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { CiftSutunlar, DonemGecis, YatayCubuk, type CiftVeri } from "@/components/finans/RaporGrafik";
import { ExcelIkon } from "@/components/finans/RaporGorunum";
import RaporUst, { type Donem } from "@/components/finans/RaporUst";
import { tlYazKisa } from "@/lib/para";

export type KdvVeri = {
  donem: Donem;
  anahtar: string;
  /** lib/kdv kdvDonemiHesapla sonucu (kuruş) */
  hesaplananKdv: number;
  indirilecekKdv: number;
  demirbasKdv: number;
  devredenKdv: number;
  yukAdet: number;
  giderAdet: number;
  kdvsizYukAdet: number;
  kdvsizGiderAdet: number;
  kategoriler: { kod: string; ad: string; kdv: number; adet: number }[];
  trend: CiftVeri[];
  excelHref: string;
};

function Bilgi({ children }: { children: ReactNode }) {
  return (
    <p className="rp-not">
      <span aria-hidden>ⓘ</span>
      <span>{children}</span>
    </p>
  );
}

/** KDV Merkezi: kayıtlara göre hesaplanan KDV farkı (beyan / ödeme işlemi değildir). */
export default function KdvGorunum({ v }: { v: KdvVeri }) {
  const fark = v.hesaplananKdv - v.indirilecekKdv;
  const enBuyukKat = Math.max(1, ...v.kategoriler.map((k) => k.kdv));

  return (
    <div className={`ana rp-genis ${anaYazi.variable}`}>
      <HareketKok>
        <RaporUst geriHref="/ozet" donem={v.donem} gorsel={{ src: "/ana/kdv-belge.png", genislik: 150 }} sinif="rp-ust-kdv">
          <div className="max-w-[62%]">
            <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">KDV Merkezi</h1>
            <p className="mt-3 text-[14.5px] font-semibold text-[#dfe4ff]">{fark >= 0 ? "Hesaplanan fark" : "Sonraki aya devreden"}</p>
            <p key={v.anahtar} className="ana-tutar mt-0.5 text-[2.5rem] font-extrabold leading-none tracking-[-0.035em] text-white">
              {tlYazKisa(Math.abs(fark))}
            </p>
            <p className="mt-1.5 text-[12px] font-medium text-[#9aa6e8]">Hesaplanan − indirilecek</p>
          </div>
        </RaporUst>

        <DonemGecis key={v.anahtar} className="ana-ic relative z-10 -mt-10 space-y-6 pb-8">
          <div className="rp-izgara">
          <div className="space-y-6">
          <section className="rp-kart px-3 py-1.5" aria-label="KDV hesabı">
            <ul>
              <li className="rp-formul">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">Hesaplanan KDV</span>
                  <span className="block text-[11.5px] text-[var(--a-ikincil)]">{v.yukAdet} sefer faturası</span>
                </span>
                <span className="text-[15.5px] font-extrabold tabular-nums">{tlYazKisa(v.hesaplananKdv)}</span>
              </li>
              <li className="rp-formul">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">İndirilecek KDV</span>
                  <span className="block text-[11.5px] text-[var(--a-ikincil)]">{v.giderAdet} gider kaydı</span>
                </span>
                <span className="text-[15.5px] font-extrabold tabular-nums">{v.indirilecekKdv > 0 ? "−" : ""}{tlYazKisa(v.indirilecekKdv)}</span>
              </li>
              <li className="rp-formul">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">Sonraki aya devreden</span>
                  <span className="block text-[11.5px] text-[var(--a-ikincil)]">İndirilecek fazlaysa</span>
                </span>
                <span className="text-[15.5px] font-extrabold tabular-nums">{tlYazKisa(v.devredenKdv)}</span>
              </li>
            </ul>
            <div className="rp-vurgu my-1.5">
              <span className="flex-1 text-[15.5px] font-extrabold text-[#3730a3]">Fark</span>
              <span className={`text-[1.3rem] font-extrabold tabular-nums ${fark < 0 ? "text-[#16a34a]" : "text-[#3730a3]"}`}>
                {fark < 0 ? "−" : ""}
                {tlYazKisa(Math.abs(fark))}
              </span>
            </div>
          </section>

          <section className="rp-kart flex items-center gap-3 px-4 py-3.5" aria-label="Demirbaş KDV">
            <span className="ana-mini-ikon rp-ikon ana-ton-indigo" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-extrabold">Demirbaş KDV</span>
              <span className="block text-[12px] text-[var(--a-ikincil)]">İndirilecek KDV içinde</span>
            </span>
            <span className="text-[16px] font-extrabold tabular-nums">{tlYazKisa(v.demirbasKdv)}</span>
          </section>

          </div>
          <div className="space-y-6">
          <section aria-labelledby="kdv-karsilastirma">
            <div className="flex items-baseline justify-between px-1">
              <h2 id="kdv-karsilastirma" className="ana-baslik">
                KDV karşılaştırması
              </h2>
              <span className="text-[12px] font-semibold text-[var(--a-ikincil)]">bin TL</span>
            </div>
            <div className="mt-1.5 flex gap-4 px-1 text-[12px] font-semibold text-[var(--a-ikincil)]">
              <span className="flex items-center gap-1.5">
                <span className="rp-cift-a h-2.5 w-2.5 rounded-full" aria-hidden />
                Hesaplanan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rp-cift-b h-2.5 w-2.5 rounded-full" aria-hidden />
                İndirilecek
              </span>
            </div>
            {v.trend.every((t) => t.a === 0 && t.b === 0) ? (
              <p className="rp-bos mt-3">Son 6 ayda KDV’li kayıt yok. Sefer ve fiş girdikçe karşılaştırma burada oluşur.</p>
            ) : (
              <div className="mt-3 px-1">
                <CiftSutunlar veri={v.trend} adA="Hesaplanan" adB="İndirilecek" />
              </div>
            )}
          </section>

          <section aria-labelledby="kdv-nereden">
            <h2 id="kdv-nereden" className="ana-baslik px-1">
              İndirilecek KDV nereden geliyor
            </h2>
            {v.kategoriler.length === 0 ? (
              <p className="rp-bos mt-2">Bu ay KDV’li gider kaydı yok. Fişleri girdikçe burası dolar.</p>
            ) : (
              <ul className="mt-1.5">
                {v.kategoriler.map((k, i) => (
                  <li key={k.kod} className="flex items-center gap-2.5 border-b border-[var(--a-cizgi)] py-2 last:border-0">
                    <span className="min-w-0 w-[7.2rem] shrink-0">
                      <span className="block truncate text-[13.5px] font-semibold">{k.ad}</span>
                      <span className="block text-[11px] text-[var(--a-ikincil)]">{k.adet} kayıt</span>
                    </span>
                    <YatayCubuk oran={k.kdv / enBuyukKat} renk="bg-gradient-to-r from-[#93c5fd] to-[#4f6bff]" gecikme={i * 0.04} />
                    <span className="w-[5rem] shrink-0 text-right text-[14px] font-extrabold tabular-nums">{tlYazKisa(k.kdv)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          </div>
          </div>

          <section className="space-y-1.5">
            <Bilgi>Kayıtlarına göre hesaplanır. Önceki aydan devreden KDV bu hesaba eklenmez.</Bilgi>
            <Bilgi>Beyan ve ödeme işlemi değildir; beyannameyi muhasebecin verir.</Bilgi>
            {(v.kdvsizYukAdet > 0 || v.kdvsizGiderAdet > 0) && (
              <Bilgi>
                Bu ay {v.kdvsizYukAdet} sefer ve {v.kdvsizGiderAdet} gider KDV’siz işaretli; hesaba katılmadı.
              </Bilgi>
            )}
          </section>

          <details className="rp-kart px-4 py-3 text-[13.5px] leading-relaxed text-[#3b4262]">
            <summary className="cursor-pointer text-[14.5px] font-extrabold text-[var(--a-murekkep)]">Kısaca nasıl işliyor</summary>
            <p className="mt-2">
              Müşteriye kestiğin faturadaki KDV <b>hesaplanan KDV</b>’dir; onu devlet adına tahsil edersin.
            </p>
            <p className="mt-1.5">
              Yakıt, lastik, bakım, demirbaş gibi harcamalarda ödediğin KDV <b>indirilecek KDV</b>’dir; hesaplanandan düşülür.
            </p>
            <p className="mt-1.5">Fark artıdaysa o ay ödenecek KDV’ye karşılık gelir, eksideyse sonraki aya devreder.</p>
          </details>

          <div className="space-y-3">
            <a href={v.excelHref} className="ana-ana-dugme w-full gap-2 !min-h-[3.3rem] !text-[1rem]">
              <ExcelIkon />
              Excel indir
            </a>
            <div className="flex justify-center gap-2">
              <Link href={`/raporlar?ay=${v.anahtar}`} className="ana-hap">
                Raporlar
              </Link>
              <Link href={`/muhasebeci?ay=${v.anahtar}`} className="ana-hap">
                Muhasebeciye gönder
              </Link>
            </div>
          </div>
        </DonemGecis>
      </HareketKok>
    </div>
  );
}
