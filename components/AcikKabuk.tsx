import type { ReactNode } from "react";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";

/**
 * Eski koyu sayfaları yeni görünüme taşır: lacivert kıvrımlı başlık zemini,
 * sayfanın kendi başlığı beyaz, içerideki renk değişkenleri açık temaya
 * çevrilir (kartlar, alanlar, düğmeler). Sayfanın işleyişine dokunmaz.
 */
export default function AcikKabuk({ children }: { children: ReactNode }) {
  return (
    <div className={`ana acik-tema rp-genis ${anaYazi.variable}`}>
      <HareketKok>
        <div className="ana-ic acik-icerik relative z-10 pb-8">{children}</div>
      </HareketKok>
    </div>
  );
}
