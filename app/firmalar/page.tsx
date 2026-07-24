import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz } from "@/lib/para";

export const revalidate = 30;

export default async function FirmalarSayfasi() {
  const firmalar = await prisma.firma.findMany({
    include: {
      yukler: {
        include: { odemeler: true },
      },
    },
    orderBy: { ad: "asc" },
  });

  const satirlar = firmalar.map((f) => {
    const anlasilan = f.yukler.reduce((t, y) => t + y.toplamTutar, 0);
    const odenen = f.yukler.reduce(
      (t, y) => t + y.odemeler.reduce((o, p) => o + p.tutar, 0),
      0
    );
    const kalan = Math.max(0, anlasilan - odenen);
    const yukSayisi = f.yukler.length;
    const acikYuk = f.yukler.filter((y) => {
      const o = y.odemeler.reduce((s, p) => s + p.tutar, 0);
      return y.toplamTutar - o > 0;
    }).length;
    return { ...f, anlasilan, odenen, kalan, yukSayisi, acikYuk };
  });

  satirlar.sort((a, b) => b.kalan - a.kalan || a.ad.localeCompare(b.ad, "tr"));

  const toplamAlacak = satirlar.reduce((t, s) => t + s.kalan, 0);
  const toplamOdenen = satirlar.reduce((t, s) => t + s.odenen, 0);
  const toplamAnlasilan = satirlar.reduce((t, s) => t + s.anlasilan, 0);
  const borcluFirma = satirlar.filter((s) => s.kalan > 0).length;

  return (
    <div className="space-y-5">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Alacaklar
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
          Firmalar / Cari
        </h1>
        <p className="mt-1 text-sm text-fog">
          Kim ne kadar ödedi, kiminde ne kaldı
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kart p-4 reveal reveal-d1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Toplam alacak
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-amber">
            {tlYaz(toplamAlacak)}
          </div>
          <div className="mt-1 text-xs text-fog">
            {borcluFirma} firmada açık bakiye
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Toplam ödenen
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-ok">
            {tlYaz(toplamOdenen)}
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Anlaşılan ciro
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-paper">
            {tlYaz(toplamAnlasilan)}
          </div>
        </div>
        <div className="kart p-4 reveal reveal-d4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
            Firma sayısı
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-paper">
            {satirlar.length}
          </div>
        </div>
      </div>

      {satirlar.length === 0 ? (
        <div className="bos-durum">
          Henüz firma yok. İlk yükü eklerken firma da oluşur.
        </div>
      ) : (
        <div className="space-y-3">
          {satirlar.map((f, i) => (
            <Link
              key={f.id}
              href={`/firmalar/${f.id}`}
              className={`kart block space-y-3 p-4 sm:p-5 reveal reveal-d${Math.min(i + 1, 6)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-display text-xl font-bold text-paper">{f.ad}</div>
                  <div className="mt-1 text-sm text-fog">
                    {f.yukSayisi} yük
                    {f.acikYuk > 0
                      ? ` · ${f.acikYuk} yükte açık bakiye`
                      : " · tümü tahsil"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                    Bu firmada kalan
                  </div>
                  <div
                    className={`font-display text-2xl font-extrabold ${
                      f.kalan > 0 ? "text-amber" : "text-ok"
                    }`}
                  >
                    {f.kalan > 0 ? tlYaz(f.kalan) : "Borç yok"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/8 bg-white/4 p-3 text-sm">
                <div>
                  <div className="text-[10px] font-bold uppercase text-fog">Anlaşılan</div>
                  <div className="font-display font-bold text-paper">{tlYaz(f.anlasilan)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-fog">Ödenen</div>
                  <div className="font-display font-bold text-ok">{tlYaz(f.odenen)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-fog">Kalan</div>
                  <div
                    className={`font-display font-extrabold ${
                      f.kalan > 0 ? "text-amber" : "text-ok"
                    }`}
                  >
                    {tlYaz(f.kalan)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
