import { prisma } from "@/lib/prisma";
import { aracEtiketBulucu } from "@/lib/aktifArac";
import { tarihYaz } from "@/lib/para";
import { kategoriAdi, GIDER_KATEGORILERI, isletmeGideriMi } from "@/lib/sabitler";
import { ayAraligi } from "@/lib/tarih";
import { ayEtiketi, ayParametresi, ayParametresiOku } from "@/lib/kdv";
import GiderlerGorunum from "@/components/gider/GiderlerGorunum";

export const dynamic = "force-dynamic";

export default async function GiderlerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string; kayit?: string }>;
}) {
  const sp = await searchParams;
  const { yil, ay } = ayParametresiOku(sp.ay);
  const { bas, son } = ayAraligi(yil, ay);
  const ayAdi = ayEtiketi(yil, ay);

  const aracEtiketi = await aracEtiketBulucu();
  const [giderler, tumGider] = await Promise.all([
    prisma.gider.findMany({
      where: { tarih: { gte: bas, lt: son } },
      orderBy: [{ tarih: "desc" }, { id: "desc" }],
    }),
    prisma.gider.aggregate({
      _sum: { toplamTutar: true, netTutar: true, kdvTutar: true },
    }),
  ]);

  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));
  const genelToplam = isletmeGiderleri.reduce((t, g) => t + g.toplamTutar, 0);
  const genelNet = isletmeGiderleri.reduce((t, g) => t + g.netTutar, 0);
  const genelKdv = giderler.reduce((t, g) => t + g.kdvTutar, 0);
  const demirbaslar = giderler.filter((g) => g.kategori === "DEMIRBAS");
  const demirbasToplam = demirbaslar.reduce((t, g) => t + g.toplamTutar, 0);
  const demirbasKdv = demirbaslar.reduce((t, g) => t + g.kdvTutar, 0);

  const kategoriToplamlari = GIDER_KATEGORILERI.filter((k) =>
    isletmeGideriMi(k.kod)
  )
    .map((k) => {
      const satirlar = isletmeGiderleri.filter((g) => g.kategori === k.kod);
      const tutar = satirlar.reduce((t, g) => t + g.toplamTutar, 0);
      const adet = satirlar.length;
      return { ...k, tutar, adet };
    })
    .filter((k) => k.adet > 0)
    .sort((a, b) => b.tutar - a.tutar);

  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const ayHref = (d: Date) => `/giderler?ay=${ayParametresi(d.getFullYear(), d.getMonth() + 1)}`;
  const ayKisa = new Intl.DateTimeFormat("tr-TR", { month: "short" });

  return (
    <GiderlerGorunum
      v={{
        ayAdi,
        oncekiHref: ayHref(onceki),
        sonrakiHref: ayHref(sonraki),
        excelHref: `/api/excel?ay=${ayParametresi(yil, ay)}`,
        kaydedildi: sp.kayit === "1",
        toplam: genelToplam,
        net: genelNet,
        kdv: genelKdv,
        bugunKadar: tumGider._sum.toplamTutar ?? 0,
        kategoriler: kategoriToplamlari.map((k) => ({ kod: k.kod, ad: k.ad, tutar: k.tutar, adet: k.adet })),
        demirbas: demirbaslar.length > 0 ? { toplam: demirbasToplam, kdv: demirbasKdv, adet: demirbaslar.length } : null,
        giderler: giderler.map((g) => ({
          id: g.id,
          gun: String(g.tarih.getDate()),
          ayKisa: ayKisa.format(g.tarih).replace(".", ""),
          kategori: g.kategori,
          kategoriAd: kategoriAdi(g.kategori),
          alt: (g.odeme === "VERESIYE" && g.veresiyeYer) || g.aciklama || tarihYaz(g.tarih),
          ek: [aracEtiketi(g.aracId), g.litre ? `${g.litre} lt` : null, g.km ? `${g.km.toLocaleString("tr-TR")} km` : null].filter(Boolean).join(" · ") || null,
          toplam: g.toplamTutar,
          net: g.netTutar,
          kdv: g.kdvTutar,
          kdvli: g.kdvli,
          veresiye: g.odeme === "VERESIYE",
          gonderildi: g.gonderildi,
          demirbas: g.kategori === "DEMIRBAS",
          fisResmi: g.fisResmi,
        })),
      }}
    />
  );
}
