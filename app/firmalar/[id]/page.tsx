import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tlYaz, tarihYaz } from "@/lib/para";
import { yukOdendiIsaretle, yukSil } from "@/app/actions";
import SilButonu from "@/components/SilButonu";
import OdendiButonu from "@/components/OdendiButonu";
import OdemeGirForm from "@/components/OdemeGirForm";
import ParaOzeti from "@/components/ParaOzeti";
import AraButonu from "@/components/AraButonu";
import { telefonGoster } from "@/lib/telefon";

export const dynamic = "force-dynamic";

export default async function FirmaDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idHam } = await params;
  const id = Number(idHam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const firma = await prisma.firma.findUnique({
    where: { id },
    include: {
      yukler: {
        include: { odemeler: true },
        orderBy: [{ tarih: "desc" }, { id: "desc" }],
      },
    },
  });
  if (!firma) notFound();

  const anlasilan = firma.yukler.reduce((t, y) => t + y.toplamTutar, 0);
  const odenen = firma.yukler.reduce(
    (t, y) => t + y.odemeler.reduce((o, p) => o + p.tutar, 0),
    0
  );
  const kalan = Math.max(0, anlasilan - odenen);

  return (
    <div className="space-y-5">
      <div className="reveal">
        <Link
          href="/para?sekme=cari"
          className="text-sm font-medium text-fog transition-colors hover:text-amber"
        >
          ← Para / cariler
        </Link>
        <h1 className="font-display mt-1 text-3xl font-extrabold text-paper sm:text-4xl">
          {firma.ad}
        </h1>
        {firma.telefon && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-fog">{telefonGoster(firma.telefon)}</p>
            <AraButonu telefon={firma.telefon} etiket="Ara" />
          </div>
        )}
      </div>

      <div className="kart space-y-3 p-4 reveal reveal-d1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
          Bu firmadaki özet
        </div>
        <ParaOzeti anlasilan={anlasilan} odenen={odenen} />
        {kalan > 0 ? (
          <p className="text-sm font-semibold text-amber">
            Bu kişide / firmada kalan alacak: {tlYaz(kalan)}
          </p>
        ) : (
          <p className="text-sm font-semibold text-ok">Bu firmada açık alacak yok.</p>
        )}
      </div>

      {firma.yukler.length === 0 ? (
        <div className="bos-durum">Bu firmaya henüz yük kaydı yok.</div>
      ) : (
        <div className="space-y-3">
          {firma.yukler.map((yuk, i) => {
            const yukOdenen = yuk.odemeler.reduce((t, o) => t + o.tutar, 0);
            const yukKalan = Math.max(0, yuk.toplamTutar - yukOdenen);

            return (
              <div
                key={yuk.id}
                className={`kart space-y-3 p-4 sm:p-5 reveal reveal-d${Math.min(i + 1, 6)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-lg font-bold text-paper">
                      {yuk.nereden} <span className="text-amber">→</span> {yuk.nereye}
                    </div>
                    <div className="mt-1 text-sm text-fog">
                      {tarihYaz(yuk.tarih)}
                      {yuk.aciklama ? ` · ${yuk.aciklama}` : ""}
                    </div>
                  </div>
                  <span
                    className={
                      yukKalan <= 0
                        ? "rozet rozet-odendi"
                        : yukOdenen > 0
                          ? "rozet rozet-kismi"
                          : "rozet rozet-bekliyor"
                    }
                  >
                    {yukKalan <= 0
                      ? "Tamam Ödendi"
                      : yukOdenen > 0
                        ? `${tlYaz(yukKalan)} kaldı`
                        : `${tlYaz(yukKalan)} bekliyor`}
                  </span>
                </div>

                <ParaOzeti anlasilan={yuk.toplamTutar} odenen={yukOdenen} />

                {yuk.odemeler.length > 0 && (
                  <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fog">
                      Ödeme geçmişi
                    </div>
                    <ul className="space-y-1 text-sm text-fog">
                      {yuk.odemeler.map((o) => (
                        <li key={o.id} className="flex justify-between gap-2">
                          <span>
                            {tarihYaz(o.tarih)}
                            {o.not ? ` · ${o.not}` : ""}
                          </span>
                          <span className="font-semibold text-ok">{tlYaz(o.tutar)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-start justify-end gap-2 border-t border-white/10 pt-3">
                  <Link
                    href={`/yukler/${yuk.id}/duzenle`}
                    className="rounded-lg border border-white/20 px-2.5 py-1.5 text-sm font-semibold text-paper transition-colors hover:border-amber/40 hover:text-amber"
                  >
                    Düzenle
                  </Link>
                  {yukKalan > 0 && (
                    <>
                      <OdemeGirForm
                        yukId={yuk.id}
                        anlasilanKurus={yuk.toplamTutar}
                        odenenKurus={yukOdenen}
                      />
                      <OdendiButonu
                        isaretle={yukOdendiIsaretle.bind(null, yuk.id)}
                      />
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
