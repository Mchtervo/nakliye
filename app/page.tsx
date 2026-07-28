import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tlYaz } from "@/lib/para";
import { isletmeGideriMi } from "@/lib/sabitler";
import { telefonGoster } from "@/lib/telefon";
import AraButonu from "@/components/AraButonu";
import AnaEkranaEkle from "@/components/AnaEkranaEkle";

export const dynamic = "force-dynamic";

export default async function PanelSayfasi() {
  const simdi = new Date();
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  const sonrakiAyBasi = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1);

  const [yukler, giderler, bekleyenYukler, hizliAraAyar, muhasebeciAyar, kasaHareketler] =
    await Promise.all([
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
      prisma.ayar.findUnique({ where: { anahtar: "hizli_ara_telefon" } }),
      prisma.ayar.findUnique({ where: { anahtar: "muhasebeci_telefon" } }),
      prisma.kasaHareket.findMany({ select: { tip: true, tutar: true } }),
    ]);

  const kasaBakiye = kasaHareketler.reduce(
    (t, h) => (h.tip === "GIRIS" ? t + h.tutar : t - h.tutar),
    0
  );

  const hizliAraTel = hizliAraAyar?.deger || "";
  const muhasebeciTel = muhasebeciAyar?.deger || "";

  const gelirToplam = yukler.reduce((t, y) => t + y.toplamTutar, 0);
  const gelirNet = yukler.reduce((t, y) => t + y.netTutar, 0);
  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));
  const giderToplam = isletmeGiderleri.reduce((t, g) => t + g.toplamTutar, 0);
  const giderNet = isletmeGiderleri.reduce((t, g) => t + g.netTutar, 0);
  const netKar = gelirNet - giderNet;

  const bekleyenAlacak = bekleyenYukler.reduce((t, y) => {
    const odenen = y.odemeler.reduce((o, p) => o + p.tutar, 0);
    return t + Math.max(0, y.toplamTutar - odenen);
  }, 0);

  const firmaAlacakMap = new Map<
    number,
    { id: number; ad: string; kalan: number; telefon: string | null }
  >();
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
        telefon: y.firma.telefon,
      });
    }
  }
  const firmaAlacaklari = [...firmaAlacakMap.values()]
    .sort((a, b) => b.kalan - a.kalan)
    .slice(0, 4);

  const ayAdi = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(simdi);

  const isler = [
    {
      href: "/ai/yukler",
      baslik: "Yük bul",
      alt: "Telegram ilanları · ara",
      ton: "amber" as const,
    },
    {
      href: "/yukler/yeni",
      baslik: "Sefer yaz",
      alt: "Taşıdığın yükü kaydet",
      ton: "teal" as const,
    },
    {
      href: "/giderler/yeni",
      baslik: "Fiş çek",
      alt: "Yakıt / bakım fotoğrafı",
      ton: "paper" as const,
    },
    {
      href: "/kasa",
      baslik: "Kasa",
      alt: kasaBakiye !== 0 ? tlYaz(kasaBakiye) : "Nakit bakiyen",
      ton: "paper" as const,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero — tek odak: bu ay kâr */}
      <section className="sayfa-hero reveal">
        <p className="sayfa-eyebrow">{ayAdi}</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[2.35rem] font-extrabold leading-[0.92] tracking-tight text-paper sm:text-5xl">
              Bu ay
              <span className="mt-1 block text-amber">ne kaldı?</span>
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-fog">
              Gelir eksi gider. Büyük rakam yeşilse ay iyi geçiyor.
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fog">
              Net kâr
            </p>
            <p
              className={`font-display text-4xl font-extrabold tabular-nums sm:text-5xl ${
                netKar >= 0 ? "text-teal" : "text-ember"
              }`}
            >
              {tlYaz(netKar)}
            </p>
          </div>
        </div>
        <div className="lane-strip mt-6 max-w-[14rem] opacity-75" />
      </section>

      <AnaEkranaEkle />

      {/* 4 büyük iş — baba için net */}
      <section className="reveal reveal-d1">
        <h2 className="sayfa-bolum">Ne yapmak istiyorsun?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3">
          {isler.map((is) => (
            <Link
              key={is.href}
              href={is.href}
              className={`is-kart is-kart-${is.ton}`}
            >
              <span className="font-display text-xl font-bold text-paper sm:text-2xl">
                {is.baslik}
              </span>
              <span className="mt-1 block text-xs text-fog sm:text-sm">{is.alt}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3 sayı — sade */}
      <section className="grid grid-cols-3 gap-2 reveal reveal-d2 sm:gap-3">
        {[
          { etiket: "Gelir", deger: tlYaz(gelirToplam), ton: "text-teal" },
          { etiket: "Gider", deger: tlYaz(giderToplam), ton: "text-ember" },
          {
            etiket: "Alacak",
            deger: tlYaz(bekleyenAlacak),
            ton: bekleyenAlacak > 0 ? "text-amber" : "text-ok",
          },
        ].map((m) => (
          <div key={m.etiket} className="metrik-sade">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fog">
              {m.etiket}
            </div>
            <div
              className={`mt-1.5 font-display text-base font-extrabold tabular-nums sm:text-xl ${m.ton}`}
            >
              {m.deger}
            </div>
          </div>
        ))}
      </section>

      {/* Hızlı ara */}
      <section className="kart space-y-3 p-4 reveal reveal-d3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-paper">Telefon</h2>
            <p className="text-xs text-fog">Kayıtlı numarayı tek tıkla ara</p>
          </div>
          <Link href="/ayarlar" className="text-xs font-semibold text-amber">
            Ayarla
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {hizliAraTel ? (
            <AraButonu
              telefon={hizliAraTel}
              etiket={`Ara · ${telefonGoster(hizliAraTel)}`}
              buyuk
            />
          ) : (
            <Link href="/ayarlar" className="btn btn-ghost text-sm">
              Numara kaydet
            </Link>
          )}
          {muhasebeciTel && (
            <AraButonu
              telefon={muhasebeciTel}
              etiket={`Muhasebeci · ${telefonGoster(muhasebeciTel)}`}
              buyuk
            />
          )}
        </div>
      </section>

      {firmaAlacaklari.length > 0 && (
        <section className="kart space-y-3 p-4 reveal reveal-d4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-paper">
                Kimde para kaldı?
              </h2>
              <p className="text-xs text-fog">Açık alacaklar</p>
            </div>
            <Link href="/firmalar" className="text-xs font-semibold text-amber">
              Tümü →
            </Link>
          </div>
          <ul className="divide-y divide-white/8">
            {firmaAlacaklari.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <Link
                  href={`/firmalar/${f.id}`}
                  className="min-w-0 flex-1 font-semibold text-paper hover:text-amber"
                >
                  {f.ad}
                </Link>
                <div className="flex items-center gap-2">
                  {f.telefon && <AraButonu telefon={f.telefon} etiket="Ara" />}
                  <span className="font-display text-lg font-extrabold text-amber tabular-nums">
                    {tlYaz(f.kalan)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="pb-2 text-center text-xs text-fog/80 reveal">
        KDV detayı için{" "}
        <Link href="/kdv" className="font-semibold text-amber">
          KDV sayfası
        </Link>
        {" · "}
        <Link href="/raporlar" className="font-semibold text-amber">
          Raporlar
        </Link>
      </p>
    </div>
  );
}
