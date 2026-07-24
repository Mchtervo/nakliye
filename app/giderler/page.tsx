import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz, tarihYaz } from "@/lib/para";
import { kategoriAdi, GIDER_KATEGORILERI, isletmeGideriMi } from "@/lib/sabitler";
import { giderSil } from "@/app/actions";
import SilButonu from "@/components/SilButonu";

export const dynamic = "force-dynamic";

export default async function GiderlerSayfasi() {
  const giderler = await prisma.gider.findMany({
    orderBy: [{ tarih: "desc" }, { id: "desc" }],
  });

  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));
  const genelToplam = isletmeGiderleri.reduce((t, g) => t + g.toplamTutar, 0);
  const genelKdv = giderler.reduce((t, g) => t + g.kdvTutar, 0);
  const demirbaslar = giderler.filter((g) => g.kategori === "DEMIRBAS");
  const demirbasToplam = demirbaslar.reduce((t, g) => t + g.toplamTutar, 0);
  const demirbasKdv = demirbaslar.reduce((t, g) => t + g.kdvTutar, 0);

  const kategoriToplamlari = GIDER_KATEGORILERI.filter((k) =>
    isletmeGideriMi(k.kod)
  )
    .map((k) => {
      const satirlar = isletmeGiderleri.filter((g) => g.kategori === k.kod);
      const tutar = satirlar.reduce((t, g) => t + g.toplamTutar, 0);
      const adet = satirlar.length;
      return { ...k, tutar, adet };
    })
    .filter((k) => k.adet > 0)
    .sort((a, b) => b.tutar - a.tutar);

  const maxKat = kategoriToplamlari[0]?.tutar || 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Harcamalar
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            Giderler
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/muhasebeci" className="btn btn-ghost !px-3 !py-2 text-xs sm:text-sm">
            Muhasebeciye Gönder
          </Link>
          <Link href="/giderler/yeni" className="btn btn-amber !px-3 !py-2 text-xs sm:text-sm">
            + Yeni Gider
          </Link>
        </div>
      </div>

      {giderler.length > 0 && (
        <section className="kart space-y-4 p-4 sm:p-5 reveal reveal-d1">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-fog">
                Toplam gider
              </div>
              <div className="font-display text-3xl font-extrabold text-ember">
                {tlYaz(genelToplam)}
              </div>
              <div className="mt-0.5 text-xs text-fog">
                {isletmeGiderleri.length} işletme gideri · tüm kayıtlarda KDV{" "}
                {tlYaz(genelKdv)}
                {demirbaslar.length > 0
                  ? ` (demirbaş KDV: ${tlYaz(demirbasKdv)})`
                  : ""}
              </div>
            </div>
          </div>

          <div className="lane-strip opacity-50" />

          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fog">
              Kategori bazlı toplam
            </div>
            <div className="space-y-3">
              {kategoriToplamlari.map((k) => {
                const yuzde = Math.round((k.tutar / maxKat) * 100);
                return (
                  <div key={k.kod}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-paper">
                        {k.ad}
                        <span className="ml-2 text-xs font-medium text-fog">
                          {k.adet} adet
                        </span>
                      </span>
                      <span className="font-display text-base font-bold text-ember">
                        {tlYaz(k.tutar)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="bar-anim h-full rounded-full bg-ember"
                        style={{ width: `${yuzde}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {demirbaslar.length > 0 && (
        <section className="kart space-y-2 border-amber/20 p-4 sm:p-5 reveal reveal-d2">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">
            Demirbaş özeti
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-display text-2xl font-extrabold text-paper">
                {tlYaz(demirbasToplam)}
              </div>
              <div className="text-xs text-fog">
                {demirbaslar.length} alım · işletme giderine yazılmadı
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                İndirilecek KDV
              </div>
              <div className="font-display text-xl font-extrabold text-amber">
                {tlYaz(demirbasKdv)}
              </div>
            </div>
          </div>
        </section>
      )}

      {giderler.length === 0 ? (
        <div className="bos-durum">
          Henüz gider kaydı yok. &quot;Yeni Gider&quot; ile ilk giderini ekle.
        </div>
      ) : (
        <div className="space-y-3">
          {giderler.map((gider, i) => (
            <div
              key={gider.id}
              className={`kart p-4 sm:p-5 reveal reveal-d${Math.min(i + 1, 6)}`}
            >
              <div className="flex gap-3">
                {gider.fisResmi ? (
                  <a
                    href={gider.fisResmi}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 overflow-hidden rounded-xl border border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gider.fisResmi}
                      alt="Fiş"
                      className="h-16 w-16 object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/4 text-[10px] text-fog">
                    Fiş yok
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-lg font-bold text-paper">
                        {kategoriAdi(gider.kategori)}
                        {gider.gonderildi && (
                          <span className="rozet rozet-odendi ml-2 align-middle">
                            Gönderildi
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-fog">
                        {tarihYaz(gider.tarih)}
                        {gider.aciklama ? ` · ${gider.aciklama}` : ""}
                        {gider.litre ? ` · ${gider.litre} lt` : ""}
                        {gider.km
                          ? ` · ${gider.km.toLocaleString("tr-TR")} km`
                          : ""}
                      </div>
                    </div>
                    <div className="font-display text-xl font-extrabold text-ember">
                      {tlYaz(gider.toplamTutar)}
                    </div>
                  </div>

                  {gider.kategori === "DEMIRBAS" && gider.kdvTutar > 0 && (
                    <div className="mt-2 rounded-lg border border-amber/20 bg-amber/10 px-2.5 py-1.5 text-sm font-semibold text-amber">
                      KDV {tlYaz(gider.kdvTutar)} · Net {tlYaz(gider.netTutar)}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
                    <div className="text-sm text-fog">
                      {gider.kdvli
                        ? `Net ${tlYaz(gider.netTutar)} + KDV ${tlYaz(gider.kdvTutar)}`
                        : "KDV'siz"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/giderler/${gider.id}/duzenle`}
                        className="rounded-lg border border-white/20 px-2.5 py-1.5 text-sm font-semibold text-paper transition-colors hover:border-amber/40 hover:text-amber"
                      >
                        Düzenle
                      </Link>
                      <SilButonu
                        onay={`${kategoriAdi(gider.kategori)} giderini (${tlYaz(
                          gider.toplamTutar
                        )}) silmek istediğine emin misin?`}
                        sil={giderSil.bind(null, gider.id)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
