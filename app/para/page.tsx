import ParaGorunum, { type ParaVeri } from "@/components/kasa/ParaGorunum";
import { prisma } from "@/lib/prisma";
import { tarihYaz } from "@/lib/para";
import { bugunTarihStr } from "@/lib/tarih";

export const dynamic = "force-dynamic";

const SEKMELER = ["ozet", "kasa", "cari"] as const;
/** Kasa sekmesinde ilk bakışta gösterilen son hareket sayısı */
const KISA_LISTE = 6;

export default async function ParaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string; tum?: string; kayit?: string }>;
}) {
  const sp = await searchParams;
  const sekme: ParaVeri["sekme"] = SEKMELER.find((s) => s === sp.sekme) ?? "ozet";
  const tum = sp.tum === "1";

  const [hareketler, toplamlar, firmalar] = await Promise.all([
    prisma.kasaHareket.findMany({
      orderBy: [{ tarih: "desc" }, { id: "desc" }],
      take: tum ? 80 : KISA_LISTE,
    }),
    // Bakiye tüm hareketlerden (ana sayfa ile aynı); liste kısaltılmış olabilir
    prisma.kasaHareket.groupBy({ by: ["tip"], _sum: { tutar: true }, _count: true }),
    prisma.firma.findMany({
      include: { yukler: { include: { odemeler: true } } },
      orderBy: { ad: "asc" },
    }),
  ]);

  const giris = toplamlar.find((t) => t.tip === "GIRIS")?._sum.tutar ?? 0;
  const cikis = toplamlar.find((t) => t.tip === "CIKIS")?._sum.tutar ?? 0;
  const toplamAdet = toplamlar.reduce((t, g) => t + g._count, 0);
  const bakiye = giris - cikis;
  const gorunenNet = hareketler.reduce((t, h) => (h.tip === "GIRIS" ? t + h.tutar : t - h.tutar), 0);
  const gizli = toplamAdet > hareketler.length;

  const cariler = firmalar.map((f) => {
    const anlasilan = f.yukler.reduce((t, y) => t + y.toplamTutar, 0);
    const odenen = f.yukler.reduce((t, y) => t + y.odemeler.reduce((o, p) => o + p.tutar, 0), 0);
    const acikYuk = f.yukler.filter((y) => y.toplamTutar - y.odemeler.reduce((s, p) => s + p.tutar, 0) > 0).length;
    return {
      id: f.id,
      ad: f.ad,
      anlasilan,
      odenen,
      kalan: Math.max(0, anlasilan - odenen),
      yukSayisi: f.yukler.length,
      acikYuk,
    };
  });
  cariler.sort((a, b) => b.kalan - a.kalan || a.ad.localeCompare(b.ad, "tr"));

  return (
    <ParaGorunum
      v={{
        sekme,
        bakiye,
        giris,
        cikis,
        hareketler: hareketler.map((h) => ({
          id: h.id,
          tarihYazi: tarihYaz(h.tarih),
          tip: h.tip,
          tutar: h.tutar,
          aciklama: h.aciklama,
        })),
        oncekiBakiye: gizli ? bakiye - gorunenNet : null,
        tumuHref: gizli && !tum ? "/para?sekme=kasa&tum=1" : null,
        cariler,
        bugunTarih: bugunTarihStr(),
        kaydedildi: sp.kayit === "1",
      }}
    />
  );
}
