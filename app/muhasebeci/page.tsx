import { prisma } from "@/lib/prisma";
import { tarihYaz } from "@/lib/para";
import { kategoriAdi } from "@/lib/sabitler";
import { ayAraligi } from "@/lib/tarih";
import { ayEtiketi, ayParametresi, ayParametresiOku } from "@/lib/kdv";
import MuhasebeciGorunum from "@/components/finans/MuhasebeciGorunum";

export const dynamic = "force-dynamic";

export default async function MuhasebeciSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const sp = await searchParams;
  const { yil, ay } = ayParametresiOku(sp.ay);

  const { bas, son } = ayAraligi(yil, ay);
  const seciliAy = ayParametresi(yil, ay);

  const [ayar, giderler] = await Promise.all([
    prisma.ayar.findUnique({ where: { anahtar: "muhasebeci_telefon" } }),
    prisma.gider.findMany({
      where: {
        tarih: { gte: bas, lt: son },
        fisResmi: { not: null },
      },
      orderBy: [{ tarih: "desc" }, { id: "desc" }],
    }),
  ]);

  // Önceki / sonraki ay linkleri
  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);

  const fisler = giderler
    .filter((g) => g.fisResmi)
    .map((g) => ({
      id: g.id,
      tarihYazi: tarihYaz(g.tarih),
      kategoriAd: kategoriAdi(g.kategori),
      aciklama: g.aciklama,
      toplamTutar: g.toplamTutar,
      fisResmi: g.fisResmi as string,
      gonderildi: g.gonderildi,
    }));

  return (
    <MuhasebeciGorunum
      donem={{
        etiket: ayEtiketi(yil, ay),
        oncekiHref: `/muhasebeci?ay=${ayParametresi(onceki.getFullYear(), onceki.getMonth() + 1)}`,
        sonrakiHref: `/muhasebeci?ay=${ayParametresi(sonraki.getFullYear(), sonraki.getMonth() + 1)}`,
      }}
      panel={{
        baslangicTelefon: ayar?.deger ?? "",
        fisler,
        ayEtiket: ayEtiketi(yil, ay),
        seciliAy,
      }}
    />
  );
}
