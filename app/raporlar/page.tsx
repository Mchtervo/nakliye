import { prisma } from "@/lib/prisma";
import { GIDER_KATEGORILERI, isletmeGideriMi } from "@/lib/sabitler";
import { ayAraligi } from "@/lib/tarih";
import { ayEtiketi, ayParametresi, ayParametresiOku } from "@/lib/kdv";
import RaporGorunum from "@/components/finans/RaporGorunum";
import { tirBazliOzet } from "@/lib/tirOzet";

export const dynamic = "force-dynamic";

export default async function RaporlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const sp = await searchParams;
  const { yil, ay } = ayParametresiOku(sp.ay);

  const { bas, son } = ayAraligi(yil, ay);
  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const anahtar = ayParametresi(yil, ay);

  const [yukler, giderler, tirlar] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: bas, lt: son } },
      select: { toplamTutar: true, netTutar: true, kdvTutar: true, firma: { select: { id: true, ad: true } } },
    }),
    prisma.gider.findMany({
      where: { tarih: { gte: bas, lt: son } },
      select: { kategori: true, toplamTutar: true, netTutar: true, kdvTutar: true },
    }),
    // Tır (şoför) bazlı gelir / gider, KDV hariç
    tirBazliOzet(bas, son),
  ]);

  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));

  // Firma bazlı ciro (KDV dahil)
  const firmaMap = new Map<number, { id: number; ad: string; tutar: number; adet: number }>();
  for (const y of yukler) {
    const f = firmaMap.get(y.firma.id);
    if (f) {
      f.tutar += y.toplamTutar;
      f.adet += 1;
    } else firmaMap.set(y.firma.id, { id: y.firma.id, ad: y.firma.ad, tutar: y.toplamTutar, adet: 1 });
  }

  // Kategori bazlı gider (demirbaş ayrı satırda kalabilir)
  const katMap = new Map<string, number>();
  for (const g of giderler) {
    katMap.set(g.kategori, (katMap.get(g.kategori) || 0) + g.toplamTutar);
  }

  return (
    <RaporGorunum
      v={{
        anahtar,
        donem: {
          etiket: ayEtiketi(yil, ay),
          oncekiHref: `/raporlar?ay=${ayParametresi(onceki.getFullYear(), onceki.getMonth() + 1)}`,
          sonrakiHref: `/raporlar?ay=${ayParametresi(sonraki.getFullYear(), sonraki.getMonth() + 1)}`,
        },
        gelirNet: yukler.reduce((t, y) => t + y.netTutar, 0),
        giderNet: isletmeGiderleri.reduce((t, g) => t + g.netTutar, 0),
        gelirToplam: yukler.reduce((t, y) => t + y.toplamTutar, 0),
        giderToplam: isletmeGiderleri.reduce((t, g) => t + g.toplamTutar, 0),
        yukAdet: yukler.length,
        giderAdet: giderler.length,
        hesaplananKdv: yukler.reduce((t, y) => t + y.kdvTutar, 0),
        indirilecekKdv: giderler.reduce((t, g) => t + g.kdvTutar, 0),
        kategoriler: GIDER_KATEGORILERI.map((k) => ({ kod: k.kod, ad: k.ad, tutar: katMap.get(k.kod) || 0 }))
          .filter((k) => k.tutar > 0)
          .sort((a, b) => b.tutar - a.tutar),
        firmalar: [...firmaMap.values()].sort((a, b) => b.tutar - a.tutar),
        araclar: tirlar,
        excelHref: `/api/excel?ay=${anahtar}`,
      }}
    />
  );
}
