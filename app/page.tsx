import { redirect } from "next/navigation";
import { Suspense } from "react";
import { aktifBaglam } from "@/lib/baglam";
import { anaPrisma } from "@/lib/prismaAna";
import { uyeDurumu } from "@/lib/uyeProfil";
import { prisma } from "@/lib/prisma";
import { tlYazKisa, tarihYaz } from "@/lib/para";
import { kategoriAdi } from "@/lib/sabitler";
import YolculukKarti from "@/components/YolculukKarti";
import Yaklasanlar from "@/components/Yaklasanlar";
import AnaSayfaGorunum from "@/components/ana/AnaSayfaGorunum";
import type { Hareket } from "@/components/ana/SonHareketler";
import { pushAcikAnahtar } from "@/lib/bildirim/push";
import { YENI_ILAN_MS } from "@/lib/ilanTazelik";
import { ayNetleri } from "@/lib/krediKarti";
import { yuklerAcikMi } from "@/lib/uyeIlan";

export const dynamic = "force-dynamic";

function selamlama(simdi: Date): string {
  const saat = (simdi.getUTCHours() + 3) % 24;
  if (saat >= 5 && saat < 11) return "Günaydın";
  if (saat >= 11 && saat < 17) return "İyi günler";
  if (saat >= 17 && saat < 22) return "İyi akşamlar";
  return "İyi geceler";
}

export default async function PanelSayfasi() {
  // Yeni üye: kurulum (araç, şehir) bitmeden ana sayfa açılmaz; yarım kaldıysa oradan sürer
  const b = await aktifBaglam();
  if (b.uyeId !== null && !(await uyeDurumu(b.uyeId))?.kurulumBitti) redirect("/kurulum");

  const simdi = new Date();
  // Üye "Yük bul"u kapattıysa ilan sayılmaz, kısayol görünmez
  const yuklerAcik = b.uyeId === null || (await yuklerAcikMi());
  const [yukler, giderler, bekleyenYukler, kasaToplam, yeniIlan, aylar] = await Promise.all([
    prisma.yuk.findMany({
      select: {
        id: true,
        tarih: true,
        nereden: true,
        nereye: true,
        toplamTutar: true,
        odemeDurumu: true,
        firma: { select: { ad: true } },
      },
      orderBy: { tarih: "desc" },
      take: 6,
    }),
    prisma.gider.findMany({
      select: { id: true, tarih: true, kategori: true, aciklama: true, toplamTutar: true },
      orderBy: { tarih: "desc" },
      take: 6,
    }),
    prisma.yuk.findMany({
      where: { odemeDurumu: { not: "ODENDI" } },
      select: {
        firmaId: true,
        toplamTutar: true,
        odemeler: { select: { tutar: true } },
        firma: { select: { ad: true, telefon: true } },
      },
    }),
    prisma.kasaHareket.groupBy({ by: ["tip"], _sum: { tutar: true } }),
    // Üyede ortak ilan listesinden sayılır (yöneticinin durumlarına bakmadan)
    yuklerAcik
      ? (b.uyeId !== null ? anaPrisma : prisma).yukIlani.count({
          where: {
            ...(b.uyeId !== null ? { durum: { notIn: ["ARSIV", "ELENDI"] } } : { durum: "YENI" }),
            // Yük bul sayfasıyla aynı: son 2 saatte paylaşılan
            sonGorulme: { gte: new Date(simdi.getTime() - YENI_ILAN_MS) },
          },
        })
      : Promise.resolve(0),
    // Ay sonu net kalan: KDV dahil, demirbaş hariç (lib/krediKarti)
    ayNetleri(6).catch(() => []),
  ]);

  const kasaBakiye = kasaToplam.reduce(
    (t, h) => (h.tip === "GIRIS" ? t + (h._sum.tutar ?? 0) : t - (h._sum.tutar ?? 0)),
    0
  );

  const firmaAlacakMap = new Map<number, { id: number; ad: string; kalan: number; telefon: string | null }>();
  for (const y of bekleyenYukler) {
    const kalan = Math.max(0, y.toplamTutar - y.odemeler.reduce((o, p) => o + p.tutar, 0));
    if (kalan <= 0) continue;
    const onceki = firmaAlacakMap.get(y.firmaId);
    if (onceki) onceki.kalan += kalan;
    else firmaAlacakMap.set(y.firmaId, { id: y.firmaId, ad: y.firma.ad, kalan, telefon: y.firma.telefon });
  }
  const firmaAlacaklari = [...firmaAlacakMap.values()].sort((a, b) => b.kalan - a.kalan).slice(0, 4);

  const hareketler: Hareket[] = [
    ...yukler.map((y) => ({
      anahtar: `y${y.id}`,
      href: `/yukler/${y.id}/duzenle`,
      baslik: `${y.nereden} → ${y.nereye}`,
      alt: y.firma.ad,
      zaman: y.tarih.getTime(),
      tarih: tarihYaz(y.tarih),
      tutar: y.toplamTutar,
      gelir: true,
      durum: y.odemeDurumu as string | null,
      kategori: null,
    })),
    ...giderler.map((g) => ({
      anahtar: `g${g.id}`,
      href: `/giderler/${g.id}/duzenle`,
      baslik: kategoriAdi(g.kategori),
      alt: g.aciklama || "Gider",
      zaman: g.tarih.getTime(),
      tarih: tarihYaz(g.tarih),
      tutar: g.toplamTutar,
      gelir: false,
      durum: null,
      kategori: g.kategori,
    })),
  ]
    .sort((a, b) => b.zaman - a.zaman);

  const ayAdi = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(simdi);

  const kisayollar = [
    ...(yuklerAcik
      ? [{ href: "/ai/yukler", ad: "Yük bul", alt: yeniIlan > 0 ? `${yeniIlan} yeni` : "İlanları tara", ikon: "/ana/k-yukbul-2.png", nokta: yeniIlan > 0 }]
      : []),
    { href: "/yukler/yeni", ad: "Sefer yaz", ikon: "/ana/k-sefer-2.png" },
    { href: "/giderler/yeni", ad: "Fiş çek", ikon: "/ana/k-fis-2.png" },
    { href: "/para", ad: "Kasa", alt: tlYazKisa(kasaBakiye), ikon: "/ana/k-kasa-2.png" },
  ];

  return (
    <AnaSayfaGorunum
      selam={selamlama(simdi)}
      ayAdi={ayAdi}
      aylar={aylar}
      kisayollar={kisayollar}
      yaklasanlar={
        <Suspense fallback={<div className="ana-iskelet h-36" />}>
          <Yaklasanlar />
        </Suspense>
      }
      yolculuk={
        <Suspense fallback={<div className="ana-iskelet h-64 !rounded-[1.8rem]" />}>
          <YolculukKarti />
        </Suspense>
      }
      hareketler={hareketler}
      alacaklar={firmaAlacaklari}
      acikAnahtar={pushAcikAnahtar()}
    />
  );
}
