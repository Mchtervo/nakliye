import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz } from "@/lib/para";

export const dynamic = "force-dynamic";

function Metrik({
  baslik,
  deger,
  alt,
  ton = "paper",
  delay = "",
}: {
  baslik: string;
  deger: string;
  alt?: string;
  ton?: "paper" | "teal" | "ember" | "amber" | "ok";
  delay?: string;
}) {
  const renk =
    ton === "teal"
      ? "text-teal"
      : ton === "ember"
        ? "text-ember"
        : ton === "amber"
          ? "text-amber"
          : ton === "ok"
            ? "text-ok"
            : "text-paper";

  return (
    <div className={`kart p-4 sm:p-5 reveal ${delay}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-fog">
        {baslik}
      </div>
      <div className={`mt-2 font-display text-2xl font-extrabold sm:text-3xl ${renk}`}>
        {deger}
      </div>
      {alt && <div className="mt-1 text-xs text-fog/80">{alt}</div>}
    </div>
  );
}

export default async function PanelSayfasi() {
  const simdi = new Date();
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  const sonrakiAyBasi = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1);

  const [yukler, giderler, bekleyenYukler] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: ayBasi, lt: sonrakiAyBasi } },
    }),
    prisma.gider.findMany({
      where: { tarih: { gte: ayBasi, lt: sonrakiAyBasi } },
    }),
    prisma.yuk.findMany({
      where: { odemeDurumu: { not: "ODENDI" } },
      include: { odemeler: true, firma: true },
    }),
  ]);

  const gelirToplam = yukler.reduce((t, y) => t + y.toplamTutar, 0);
  const gelirNet = yukler.reduce((t, y) => t + y.netTutar, 0);
  const toplananKdv = yukler.reduce((t, y) => t + y.kdvTutar, 0);
  const giderToplam = giderler.reduce((t, g) => t + g.toplamTutar, 0);
  const giderNet = giderler.reduce((t, g) => t + g.netTutar, 0);
  const odenenKdv = giderler.reduce((t, g) => t + g.kdvTutar, 0);
  const netKar = gelirNet - giderNet;
  const kdvFarki = toplananKdv - odenenKdv;

  const bekleyenAlacak = bekleyenYukler.reduce((t, y) => {
    const odenen = y.odemeler.reduce((o, p) => o + p.tutar, 0);
    return t + Math.max(0, y.toplamTutar - odenen);
  }, 0);

  const firmaAlacakMap = new Map<number, { id: number; ad: string; kalan: number }>();
  for (const y of bekleyenYukler) {
    const odenen = y.odemeler.reduce((o, p) => o + p.tutar, 0);
    const kalan = Math.max(0, y.toplamTutar - odenen);
    if (kalan <= 0) continue;
    const onceki = firmaAlacakMap.get(y.firmaId);
    if (onceki) {
      onceki.kalan += kalan;
    } else {
      firmaAlacakMap.set(y.firmaId, {
        id: y.firmaId,
        ad: y.firma.ad,
        kalan,
      });
    }
  }
  const firmaAlacaklari = [...firmaAlacakMap.values()]
    .sort((a, b) => b.kalan - a.kalan)
    .slice(0, 5);

  const ayAdi = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(simdi);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="kart relative overflow-hidden p-5 sm:p-8 reveal">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #f0a020, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #2ec4a6, transparent 70%)" }}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber">
              {ayAdi} · yol defteri
            </p>
            <h1 className="font-display mt-2 text-4xl font-extrabold leading-[0.95] text-paper sm:text-5xl lg:text-6xl">
              Bu ayın
              <span className="block text-amber">net kârı</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-fog">
              Gelir, gider ve KDV tek bakışta. Fişleri yükle, alacakları takip et,
              muhasebecine tek tıkla gönder.
            </p>
            <div className="lane-strip mt-5 max-w-xs" />
          </div>

          <div className="lg:text-right">
            <div
              className={`font-display text-5xl font-extrabold sm:text-6xl ${
                netKar >= 0 ? "text-teal" : "text-ember"
              }`}
            >
              {tlYaz(netKar)}
            </div>
            <p className="mt-1 text-xs font-medium text-fog">KDV hariç net</p>
            <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
              <Link href="/yukler/yeni" className="btn btn-amber">
                + Yeni yük
              </Link>
              <Link href="/giderler/yeni" className="btn btn-ghost">
                + Gider
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metrik
          baslik="Bu ay gelir"
          deger={tlYaz(gelirToplam)}
          alt={`${yukler.length} yük taşındı`}
          ton="teal"
          delay="reveal-d1"
        />
        <Metrik
          baslik="Bu ay gider"
          deger={tlYaz(giderToplam)}
          alt={`${giderler.length} gider kaydı`}
          ton="ember"
          delay="reveal-d2"
        />
        <Metrik
          baslik="Toplanan KDV"
          deger={tlYaz(toplananKdv)}
          alt="Faturalardaki KDV"
          delay="reveal-d3"
        />
        <Metrik
          baslik="Ödenen KDV"
          deger={tlYaz(odenenKdv)}
          alt="Giderlerdeki KDV"
          delay="reveal-d4"
        />
        <Metrik
          baslik="KDV farkı"
          deger={tlYaz(kdvFarki)}
          alt="Yaklaşık vergi yükü"
          ton="amber"
          delay="reveal-d5"
        />
        <Metrik
          baslik="Toplam alacak"
          deger={tlYaz(bekleyenAlacak)}
          alt={
            firmaAlacaklari.length > 0
              ? `${firmaAlacaklari.length} firmada açık bakiye`
              : "Hepsi tahsil edildi"
          }
          ton={bekleyenAlacak > 0 ? "amber" : "ok"}
          delay="reveal-d6"
        />
      </div>

      {firmaAlacaklari.length > 0 && (
        <section className="kart space-y-3 p-4 sm:p-5 reveal">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">
                Kimde ne kaldı
              </div>
              <h2 className="font-display text-xl font-bold text-paper">
                Açık alacaklar
              </h2>
            </div>
            <Link
              href="/firmalar"
              className="text-sm font-semibold text-fog transition-colors hover:text-amber"
            >
              Tüm cari →
            </Link>
          </div>
          <ul className="divide-y divide-white/8">
            {firmaAlacaklari.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/firmalar/${f.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-amber"
                >
                  <span className="font-medium text-paper">{f.ad}</span>
                  <span className="font-display font-extrabold text-amber">
                    {tlYaz(f.kalan)} kaldı
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/firmalar",
            baslik: "Firmalar / Cari",
            alt: "Kim ne kadar ödedi / kaldı",
            ikon: "01",
          },
          {
            href: "/raporlar",
            baslik: "Raporlar",
            alt: "Aylık özet ve dağılım",
            ikon: "02",
          },
          {
            href: "/muhasebeci",
            baslik: "Muhasebeciye gönder",
            alt: "Fişleri toplu paylaş",
            ikon: "03",
          },
        ].map((k, i) => (
          <Link
            key={k.href}
            href={k.href}
            className={`kart group p-5 reveal reveal-d${i + 1}`}
          >
            <div className="flex items-start justify-between">
              <span className="font-display text-2xl font-bold text-amber/40 transition-colors group-hover:text-amber">
                {k.ikon}
              </span>
              <span className="text-fog transition-transform group-hover:translate-x-1">→</span>
            </div>
            <div className="mt-6 font-display text-xl font-bold text-paper">{k.baslik}</div>
            <div className="mt-1 text-sm text-fog">{k.alt}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
