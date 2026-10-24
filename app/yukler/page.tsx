import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz, tarihYaz } from "@/lib/para";
import { ayAraligi } from "@/lib/tarih";
import { ayEtiketi, ayParametresi, ayParametresiOku } from "@/lib/kdv";
import { yukSil, yukOdendiIsaretle } from "@/app/actions";
import AySecici from "@/components/AySecici";
import SilButonu from "@/components/SilButonu";
import OdendiButonu from "@/components/OdendiButonu";
import OdemeGirForm from "@/components/OdemeGirForm";
import ParaOzeti from "@/components/ParaOzeti";

export const dynamic = "force-dynamic";

function DurumRozeti({ odenen, kalan }: { odenen: number; kalan: number }) {
  if (kalan <= 0) {
    return <span className="rozet rozet-odendi">Tamam Ödendi</span>;
  }
  if (odenen > 0) {
    return <span className="rozet rozet-kismi">{tlYaz(kalan)} kaldı</span>;
  }
  return <span className="rozet rozet-bekliyor">{tlYaz(kalan)} bekliyor</span>;
}

export default async function YuklerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const { yil, ay } = ayParametresiOku((await searchParams).ay);
  const { bas, son } = ayAraligi(yil, ay);
  const ayAdi = ayEtiketi(yil, ay);

  const [yukler, tumYuk] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: bas, lt: son } },
      include: { firma: true, odemeler: true },
      orderBy: [{ tarih: "desc" }, { id: "desc" }],
    }),
    prisma.yuk.aggregate({
      _sum: { toplamTutar: true, netTutar: true, kdvTutar: true },
    }),
  ]);

  const gelirToplam = yukler.reduce((t, y) => t + y.toplamTutar, 0);
  const gelirNet = yukler.reduce((t, y) => t + y.netTutar, 0);
  const gelirKdv = yukler.reduce((t, y) => t + y.kdvTutar, 0);
  const tahsil = yukler.reduce(
    (t, y) => t + y.odemeler.reduce((o, p) => o + p.tutar, 0),
    0
  );
  const kalanAlacak = Math.max(0, gelirToplam - tahsil);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="sayfa-eyebrow">Senin taşıdıkların</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-paper sm:text-4xl">
            Seferler
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/excel?ay=${ayParametresi(yil, ay)}`} className="btn btn-teal">
            Excel indir
          </a>
          <Link href="/yukler/yeni" className="btn btn-amber">
            + Yeni Yük
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AySecici yol="/yukler" yil={yil} ay={ay} />
        <p className="text-xs text-fog">
          Bugüne kadar {tlYaz(tumYuk._sum.toplamTutar ?? 0)} · net{" "}
          {tlYaz(tumYuk._sum.netTutar ?? 0)}
        </p>
      </div>

      <section className="kart grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">
            {ayAdi} toplam
          </p>
          <p className="mt-1 font-display text-xl font-extrabold tabular-nums">
            {tlYaz(gelirToplam)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Net gelir
          </p>
          <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-ok">
            {tlYaz(gelirNet)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">
            KDV
          </p>
          <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-amber">
            {tlYaz(gelirKdv)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-fog">
            {kalanAlacak > 0 ? "Kalan alacak" : "Tahsil"}
          </p>
          <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-amber">
            {tlYaz(kalanAlacak > 0 ? kalanAlacak : tahsil)}
          </p>
        </div>
      </section>

      {yukler.length === 0 ? (
        <div className="bos-durum">
          {ayAdi} ayında sefer yok. &quot;Yeni Yük&quot; ile ekle veya başka ay seç.
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
                  <Link
                    href={`/yukler/${yuk.id}/duzenle`}
                    className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-sm font-bold text-paper transition-colors hover:border-amber/50 hover:text-amber"
                  >
                    Düzenle
                  </Link>
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
