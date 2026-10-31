import Image from "next/image";
import type { ReactNode } from "react";
import TelefonTuslari from "@/components/TelefonTuslari";
import BildirimZili from "@/components/BildirimZili";
import { HareketKok } from "@/components/ana/Hareket";
import { AySecimSaglayici, AyinHesabi, BaslikOzet, type AyNetGorunum } from "@/components/ana/AyOzeti";
import Kisayollar from "@/components/ana/Kisayollar";
import TirSahnesi from "@/components/ana/TirSahnesi";
import SonHareketler, { type Hareket } from "@/components/ana/SonHareketler";
import Alacaklar, { type Alacak } from "@/components/ana/Alacaklar";
import { anaYazi } from "@/components/ana/yazi";

type Kisayol = { href: string; ad: string; alt?: string; ikon: string; nokta?: boolean };

/**
 * Ana sayfa yerleşimi (veri dışarıdan). Canlı sayfa ve yerel önizleme
 * (/ana-onizleme, örnek veri) aynı tasarımı kullanır.
 */
export default function AnaSayfaGorunum({
  selam,
  ayAdi,
  aylar,
  kisayollar,
  yaklasanlar,
  yolculuk,
  hareketler,
  alacaklar,
  acikAnahtar,
}: {
  selam: string;
  ayAdi: string;
  aylar: AyNetGorunum[];
  kisayollar: Kisayol[];
  yaklasanlar: ReactNode;
  yolculuk: ReactNode;
  hareketler: Hareket[];
  alacaklar: Alacak[];
  acikAnahtar: string | null;
}) {
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <AySecimSaglayici aylar={aylar}>
          {/* Lacivert başlık: kıvrımlı katmanlar, net kalan, 6 aylık grafik, tır */}
          <header className="ana-ust">
            <div className="ana-ust-zemin" aria-hidden />
            <div className="ana-ic relative">
              <div className="ana-gir flex items-center justify-between gap-3 pt-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Image src="/ana/logo-2.png" alt="" width={46} height={41} className="h-[41px] w-[46px] shrink-0" priority />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[21px] font-extrabold tracking-[-0.02em] text-white">Nakliye Defteri</p>
                    <p className="text-[14px] font-semibold text-[#9fb0ff]">Yük Avcısı</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden text-right leading-tight min-[360px]:block">
                    <p className="text-[14px] font-semibold text-[#dfe4ff]">{selam}</p>
                    <p className="text-[12.5px] text-[#9aa6e8] first-letter:uppercase">{ayAdi}</p>
                  </div>
                  <BildirimZili tema="cam" />
                </div>
              </div>

              <div className="relative mt-5 min-h-[12.2rem]">
                <div className="relative z-10 max-w-[60%]">
                  <BaslikOzet />
                </div>
                <TirSahnesi />
              </div>
            </div>
          </header>

          <div className="ana-ic relative z-10">
            <Kisayollar ogeler={kisayollar} />

            <div className="mt-5 space-y-5">
              {yaklasanlar}
              {yolculuk}
              <AyinHesabi />
              <SonHareketler hareketler={hareketler} />
              <Alacaklar firmalar={alacaklar} />
              <TelefonTuslari acikAnahtar={acikAnahtar} tema="acik" />
            </div>
          </div>
        </AySecimSaglayici>
      </HareketKok>
    </div>
  );
}
