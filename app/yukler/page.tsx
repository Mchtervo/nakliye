import { prisma } from "@/lib/prisma";
import { aracEtiketBulucu } from "@/lib/aktifArac";
import { ayAraligi } from "@/lib/tarih";
import { ayEtiketi, ayParametresi, ayParametresiOku } from "@/lib/kdv";
import SeferlerGorunum from "@/components/sefer/SeferlerGorunum";

export const dynamic = "force-dynamic";

export default async function YuklerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const { yil, ay } = ayParametresiOku((await searchParams).ay);
  const { bas, son } = ayAraligi(yil, ay);
  const ayAdi = ayEtiketi(yil, ay);

  const aracEtiketi = await aracEtiketBulucu();
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

  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const ayHref = (d: Date) => `/yukler?ay=${ayParametresi(d.getFullYear(), d.getMonth() + 1)}`;
  const kisa = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" });
  const uzun = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <SeferlerGorunum
      v={{
        ayAdi,
        oncekiHref: ayHref(onceki),
        sonrakiHref: ayHref(sonraki),
        excelHref: `/api/excel?ay=${ayParametresi(yil, ay)}`,
        toplam: gelirToplam,
        tahsil,
        kalan: kalanAlacak,
        net: gelirNet,
        kdv: gelirKdv,
        bugunKadar: tumYuk._sum.toplamTutar ?? 0,
        seferler: yukler.map((y) => ({
          id: y.id,
          nereden: y.nereden,
          nereye: y.nereye,
          firma: y.firma.ad,
          tarihKisa: kisa.format(y.tarih),
          tarihUzun: uzun.format(y.tarih),
          aciklama: y.aciklama,
          arac: aracEtiketi(y.aracId),
          toplam: y.toplamTutar,
          odenen: y.odemeler.reduce((t, o) => t + o.tutar, 0),
          net: y.netTutar,
          kdv: y.kdvTutar,
          kdvli: y.kdvli,
        })),
      }}
    />
  );
}
