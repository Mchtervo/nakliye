import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz, tarihYaz } from "@/lib/para";
import { yukSil, yukOdendiIsaretle } from "@/app/actions";
import SilButonu from "@/components/SilButonu";
import OdendiButonu from "@/components/OdendiButonu";
import OdemeGirForm from "@/components/OdemeGirForm";
import ParaOzeti from "@/components/ParaOzeti";

export const revalidate = 30;

function DurumRozeti({ odenen, kalan }: { odenen: number; kalan: number }) {
  if (kalan <= 0) {
    return <span className="rozet rozet-odendi">Tamam Ödendi</span>;
  }
  if (odenen > 0) {
    return <span className="rozet rozet-kismi">{tlYaz(kalan)} kaldı</span>;
  }
  return <span className="rozet rozet-bekliyor">{tlYaz(kalan)} bekliyor</span>;
}

export default async function YuklerSayfasi() {
  const yukler = await prisma.yuk.findMany({
    include: { firma: true, odemeler: true },
    orderBy: [{ tarih: "desc" }, { id: "desc" }],
  });

  const toplamAlacak = yukler.reduce((t, y) => {
    const odenen = y.odemeler.reduce((o, p) => o + p.tutar, 0);
    return t + Math.max(0, y.toplamTutar - odenen);
  }, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Seferler
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            Yükler
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toplamAlacak > 0 && (
            <div className="kart px-3 py-2 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber">
                Toplam kalan alacak
              </div>
              <div className="font-display text-lg font-extrabold text-amber">
                {tlYaz(toplamAlacak)}
              </div>
            </div>
          )}
          <Link href="/yukler/yeni" className="btn btn-amber">
            + Yeni Yük
          </Link>
        </div>
      </div>

      {yukler.length === 0 ? (
        <div className="bos-durum">
          Henüz yük kaydı yok. &quot;Yeni Yük&quot; ile ilk taşımanı ekle.
        </div>
      ) : (
        <div className="space-y-3">
          {yukler.map((yuk, i) => {
            const odenen = yuk.odemeler.reduce((t, o) => t + o.tutar, 0);
            const kalan = Math.max(0, yuk.toplamTutar - odenen);
            return (
              <div
                key={yuk.id}
                className={`kart space-y-3 p-4 sm:p-5 reveal reveal-d${Math.min(i + 1, 6)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-xl font-bold text-paper">
                      {yuk.nereden}
                      <span className="mx-2 text-amber">→</span>
                      {yuk.nereye}
                    </div>
                    <div className="mt-1 text-sm text-fog">
                      {yuk.firma.ad} · {tarihYaz(yuk.tarih)}
                      {yuk.aciklama ? ` · ${yuk.aciklama}` : ""}
                    </div>
                  </div>
                  <DurumRozeti odenen={odenen} kalan={kalan} />
                </div>

                <ParaOzeti anlasilan={yuk.toplamTutar} odenen={odenen} />

                <div className="text-sm text-fog">
                  {yuk.kdvli
                    ? `Net ${tlYaz(yuk.netTutar)} + KDV ${tlYaz(yuk.kdvTutar)}`
                    : "KDV'siz iş"}
                </div>

                <div className="flex flex-wrap items-start justify-end gap-2 border-t border-white/10 pt-3">
                  {kalan > 0 && (
                    <>
                      <OdemeGirForm
                        yukId={yuk.id}
                        anlasilanKurus={yuk.toplamTutar}
                        odenenKurus={odenen}
                      />
                      <OdendiButonu isaretle={yukOdendiIsaretle.bind(null, yuk.id)} />
                    </>
                  )}
                  <SilButonu
                    onay={`${yuk.nereden} → ${yuk.nereye} yükünü silmek istediğine emin misin?`}
                    sil={yukSil.bind(null, yuk.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
