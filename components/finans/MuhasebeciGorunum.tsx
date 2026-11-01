import type { ComponentProps } from "react";
import MuhasebeciPaneli from "@/components/MuhasebeciPaneli";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import { DonemGecis } from "@/components/finans/RaporGrafik";
import RaporUst, { type Donem } from "@/components/finans/RaporUst";

/** Muhasebeciye gönder: başlık + dönem seçici + fiş seçimi / paket / paylaşım paneli. */
export default function MuhasebeciGorunum({ donem, panel }: { donem: Donem; panel: ComponentProps<typeof MuhasebeciPaneli> }) {
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <RaporUst geriHref="/ozet" donem={donem} gorsel={{ src: "/ana/fis-deste.png", genislik: 130 }}>
          <div className="max-w-[66%]">
            <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Muhasebeciye gönder</h1>
            <p className="mt-1 text-[13.5px] text-[#c7cffd]">Seçtiğin fişleri paketle ve paylaş</p>
          </div>
        </RaporUst>
        <DonemGecis key={panel.seciliAy} className="ana-ic relative z-10 -mt-8 pb-8">
          <MuhasebeciPaneli key={panel.seciliAy} {...panel} />
        </DonemGecis>
      </HareketKok>
    </div>
  );
}
