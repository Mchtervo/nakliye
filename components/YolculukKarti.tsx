import Link from "next/link";
import { donusTalebiKapat } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import YolculukFormu from "@/components/YolculukFormu";
import { aktifYolculuklar, ilde, yakinIller } from "@/lib/donus";
import { ilMesafesiKm } from "@/lib/ilMesafe";
import { ILLER } from "@/lib/iller";
import { tlYazKisa } from "@/lib/para";

/**
 * Ana sayfa "Yolculuğum": yükleme → boşaltma. Boşaltılan il ve 90 km
 * çevresindeki yükler burada ve bildirimde ("Düzce'de yük bulundu").
 */
export default async function YolculukKarti() {
  const yolculuklar = await aktifYolculuklar().catch(() => []);

  return (
    <section id="yolculuk" className="kart space-y-3 p-4 sm:p-5 reveal">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">Yolculuğum</p>
        <h2 className="font-display text-xl font-bold">
          {yolculuklar.length > 0 ? "Vardığın yerde yük arıyorum" : "Yolculuk nereye?"}
        </h2>
        {yolculuklar.length === 0 && (
          <p className="mt-1 text-sm text-fog">
            Nereden yükleyip nereye gittiğini yaz; vardığın yerde ve 90 km çevresinde dönüş yükü
            çıkınca telefona bildirim gelsin.
          </p>
        )}
      </div>

      {yolculuklar.map((y) => {
        const cevre = yakinIller(y.cikisIl).slice(1);
        return (
          <div key={y.id} className="space-y-2 rounded-2xl bg-white/[0.04] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-paper">
                  {y.varis} → {y.cikis}
                </p>
                <p className="text-xs text-fog">
                  {ilde(y.cikisIl)}
                  {cevre.length > 0 ? ` + ${cevre.join(", ")}` : ""} taranıyor
                </p>
              </div>
              <AksiyonButonu
                calistir={donusTalebiKapat.bind(null, y.id)}
                etiket="Aramayı durdur"
                bekleyenEtiket="Durduruluyor…"
                sinif="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-fog hover:bg-white/5 hover:text-ember"
              />
            </div>
            {y.ilanlar.length === 0 ? (
              <p className="text-sm text-fog">Henüz yük yok. Çıkınca bildirim gelecek.</p>
            ) : (
              <ul className="space-y-1.5">
                {y.ilanlar.map((i) => {
                  const km = i.cikisIl && i.cikisIl !== y.cikisIl ? ilMesafesiKm(y.cikisIl, i.cikisIl) : null;
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/ai/yukler?sekme=HEPSI&id=${i.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-teal/10 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-paper">
                          {i.nereden || i.cikisIl} → {i.nereye || "?"}
                          {km !== null && <span className="ml-1 text-xs text-fog">({km} km)</span>}
                        </span>
                        {(i.ucret ?? i.fiyatTon) !== null && (
                          <span className="shrink-0 font-semibold text-teal">
                            {tlYazKisa((i.ucret ?? i.fiyatTon)!)}
                            {i.ucret === null ? "/t" : ""}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <YolculukFormu
              ilkAcik={false}
              iller={ILLER}
              acmaEtiketi={`Yük aldım → ${y.cikis} çıkışlı yeni yolculuk`}
              varsayilanYukleme={y.cikis}
              kapatId={y.id}
            />
          </div>
        );
      })}

      <YolculukFormu ilkAcik={yolculuklar.length === 0} iller={ILLER} />
    </section>
  );
}
