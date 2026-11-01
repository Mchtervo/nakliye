import Image from "next/image";
import BildirimZili from "@/components/BildirimZili";
import PlanForm from "@/components/PlanForm";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import PlanAlternatifleri from "@/components/sefer/PlanAlternatifleri";
import PlanKart from "@/components/sefer/PlanKart";
import RotaCizgi from "@/components/yuk/RotaCizgi";
import type { SeferPlani } from "@/lib/seferPlan";

/** Tur planı görünümü (veri dışarıdan; yerel önizleme örnek veriyle kullanır). */
export default function PlanGorunum({
  neredeHam,
  baslangic,
  gun,
  planlar,
}: {
  neredeHam: string;
  baslangic: string | null;
  gun: number;
  planlar: SeferPlani[];
}) {
  const ilk = planlar[0];
  const son = ilk?.ayaklar[ilk.ayaklar.length - 1];
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
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
              <BildirimZili tema="cam" />
            </div>
            <div className="ana-gir mt-3" style={{ animationDelay: "40ms" }}>
              <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-[-0.03em] text-white">Tur planı</h1>
              <p className="text-[14px] text-[#b8c1f5]">Varıştan sonraki yükleri sıralayarak turunu planla</p>
            </div>
            <div className="ana-gir" style={{ animationDelay: "60ms" }}>
              <RotaCizgi sol={baslangic} sag={son ? son.ilan.nereye || son.ilan.varisIl : null} />
            </div>
          </div>
        </header>

        <div className="ana-ic relative z-10 pb-6">
          <PlanForm key={`${neredeHam}|${gun}`} baslangic={neredeHam} gun={gun} />

          <div className="mt-5 space-y-4">
            {!baslangic && (
              <p role="alert" className="rounded-2xl bg-[#fee2e2] px-4 py-3 text-[13.5px] font-semibold text-[#b91c1c]">
                Yer adı çözülemedi: «{neredeHam}». İl veya ilçe yaz.
              </p>
            )}

            {baslangic && planlar.length === 0 && (
              <div className="rounded-[1.4rem] bg-white px-5 py-7 text-center text-[14px] text-[#3b4262] shadow-[var(--a-golge)]">
                {baslangic} çıkışlı uygun zincir yok. Daha fazla ilan birikince veya gün sayısını artırınca dene.
              </div>
            )}

            {ilk && (
              <section>
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="ana-baslik">Önerilen tur planı</h2>
                  <span className="text-[12.5px] font-semibold text-[var(--a-ikincil)]">
                    {baslangic} · {gun} gün
                  </span>
                </div>
                <div className="sf-kart mt-3">
                  <PlanKart plan={ilk} />
                </div>
              </section>
            )}

            <PlanAlternatifleri planlar={planlar.slice(1)} />
          </div>
        </div>
      </HareketKok>
    </div>
  );
}
