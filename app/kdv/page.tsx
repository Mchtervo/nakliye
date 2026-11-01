import { ayEtiketi, ayKisaEtiketi, ayParametresi, ayParametresiOku, kdvDonemiHesapla, sonAylarKdv } from "@/lib/kdv";
import KdvGorunum from "@/components/finans/KdvGorunum";

export const dynamic = "force-dynamic";

export default async function KdvMerkeziSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const sp = await searchParams;
  const { yil, ay } = ayParametresiOku(sp.ay);

  const [donem, trend] = await Promise.all([kdvDonemiHesapla(yil, ay), sonAylarKdv(6, yil, ay)]);

  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const anahtar = ayParametresi(yil, ay);

  return (
    <KdvGorunum
      v={{
        anahtar,
        donem: {
          etiket: ayEtiketi(yil, ay),
          oncekiHref: `/kdv?ay=${ayParametresi(onceki.getFullYear(), onceki.getMonth() + 1)}`,
          sonrakiHref: `/kdv?ay=${ayParametresi(sonraki.getFullYear(), sonraki.getMonth() + 1)}`,
        },
        hesaplananKdv: donem.hesaplananKdv,
        indirilecekKdv: donem.indirilecekKdv,
        demirbasKdv: donem.demirbasKdv,
        devredenKdv: donem.devredenKdv,
        yukAdet: donem.yukAdet,
        giderAdet: donem.giderAdet,
        kdvsizYukAdet: donem.kdvsizYukAdet,
        kdvsizGiderAdet: donem.kdvsizGiderAdet,
        kategoriler: donem.kategoriler.map((k) => ({ kod: k.kod, ad: k.ad, kdv: k.kdv, adet: k.adet })),
        trend: trend.map((t) => ({
          anahtar: ayParametresi(t.yil, t.ay),
          etiket: ayKisaEtiketi(t.yil, t.ay).replace(".", ""),
          a: t.hesaplananKdv,
          b: t.indirilecekKdv,
        })),
        excelHref: `/api/excel?ay=${anahtar}`,
      }}
    />
  );
}
