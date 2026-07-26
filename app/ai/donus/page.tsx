import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { kurustanGiris, tarihYaz, tlYaz } from "@/lib/para";
import { donusTalebiKapat, simdiTara } from "@/app/ai-actions";
import AksiyonButonu from "@/components/AksiyonButonu";
import IlanAksiyonlari from "@/components/IlanAksiyonlari";
import { SUPHE_SINIRI } from "@/lib/kaynaklar/filtre";

export const dynamic = "force-dynamic";

export default async function DonusYukuSayfasi() {
  const talepler = await prisma.donusTalebi.findMany({
    where: { aktif: true },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      ilanlar: {
        where: {
          durum: { in: ["YENI", "ILGILENIYOR"] },
          guvenSkoru: { gte: SUPHE_SINIRI },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  const kapananSayisi = await prisma.donusTalebi.count({
    where: { aktif: false },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal">
            Yapay zekâ
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            Dönüş Yükü
          </h1>
          <p className="mt-1 text-sm text-fog">
            Her yük kaydında ters yön için arama kendiliğinden açılır. Boş dönme.
          </p>
        </div>
        <AksiyonButonu
          calistir={simdiTara}
          etiket="Şimdi tara"
          bekleyenEtiket="Taranıyor..."
          sinif="btn btn-teal !px-3 !py-2 text-xs sm:text-sm"
        />
      </div>

      {talepler.length === 0 ? (
        <div className="bos-durum">
          Açık dönüş talebi yok. Yeni bir yük kaydettiğinde (örn. Ankara →
          Bolu), sistem Bolu → Ankara yükü aramaya başlar.
        </div>
      ) : (
        <div className="space-y-3">
          {talepler.map((talep, i) => (
            <section
              key={talep.id}
              className={`kart space-y-3 p-4 sm:p-5 reveal reveal-d${Math.min(i + 1, 6)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg font-bold text-paper">
                    {talep.cikis} → {talep.varis}
                  </div>
                  <div className="text-xs text-fog">
                    {tarihYaz(talep.createdAt)} tarihinde açıldı ·{" "}
                    {talep.eslesmeAdet} eşleşme
                    {talep.sonKontrol
                      ? ` · son kontrol ${tarihYaz(talep.sonKontrol)}`
                      : ""}
                  </div>
                </div>
                <AksiyonButonu
                  calistir={donusTalebiKapat.bind(null, talep.id)}
                  etiket="Aramayı kapat"
                  bekleyenEtiket="Kapatılıyor..."
                  sinif="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fog hover:bg-white/5 hover:text-paper"
                />
              </div>

              {talep.ilanlar.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/12 px-3 py-2.5 text-sm text-fog">
                  Henüz eşleşme yok. Bu rotada yük çıkınca haber vereceğim.
                </p>
              ) : (
                <div className="space-y-2 border-t border-white/8 pt-3">
                  {talep.ilanlar.map((ilan) => (
                    <div
                      key={ilan.id}
                      className="rounded-xl border border-teal/25 bg-teal/8 p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold text-paper">
                          {ilan.nereden || ilan.cikisIl} →{" "}
                          {ilan.nereye || ilan.varisIl}
                          {ilan.firmaAdi && (
                            <span className="ml-2 text-sm font-medium text-fog">
                              {ilan.firmaAdi}
                            </span>
                          )}
                        </span>
                        {ilan.ucret !== null && (
                          <span className="font-display text-lg font-extrabold text-teal">
                            {tlYaz(ilan.ucret)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-fog">
                        {ilan.hamMetin.slice(0, 200)}
                      </p>
                      <div className="mt-2">
                        <IlanAksiyonlari
                          ilan={{
                            id: ilan.id,
                            durum: ilan.durum,
                            nereden: ilan.nereden,
                            nereye: ilan.nereye,
                            firmaAdi: ilan.firmaAdi,
                            telefon: ilan.telefon,
                            ucretYazi:
                              ilan.ucret !== null ? kurustanGiris(ilan.ucret) : null,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/ai/yukler" className="font-medium text-fog hover:text-amber">
          Tüm ilanlar →
        </Link>
        {kapananSayisi > 0 && (
          <span className="text-fog">{kapananSayisi} kapalı talep</span>
        )}
      </div>
    </div>
  );
}
