import { prisma } from "@/lib/prisma";
import { aktifBaglam } from "@/lib/baglam";
import { isletmeGideriMi } from "@/lib/sabitler";
import { ayParametresi } from "@/lib/kdv";
import FinansOzetGorunum from "@/components/finans/FinansOzetGorunum";

export const dynamic = "force-dynamic";

const AY_SAYISI = 6;

export default async function OzetSayfasi() {
  const simdi = new Date();
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
  const gecenAyBasi = new Date(simdi.getFullYear(), simdi.getMonth() - 1, 1);
  const sonrakiAyBasi = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1);
  const grafikBasi = new Date(simdi.getFullYear(), simdi.getMonth() - (AY_SAYISI - 1), 1);

  const [yukler, giderler, bekleyenYukler, ayarlar, kasaToplam, tumYuk, tumGider, baglam] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: grafikBasi, lt: sonrakiAyBasi } },
      select: { id: true, tarih: true, netTutar: true, toplamTutar: true },
    }),
    prisma.gider.findMany({
      where: { tarih: { gte: grafikBasi, lt: sonrakiAyBasi } },
      select: { tarih: true, kategori: true, netTutar: true, toplamTutar: true },
    }),
    prisma.yuk.findMany({
      where: { odemeDurumu: { not: "ODENDI" } },
      select: { id: true, firmaId: true, toplamTutar: true, odemeler: { select: { tutar: true } } },
    }),
    prisma.ayar.findMany({
      where: { anahtar: { in: ["hizli_ara_telefon", "muhasebeci_telefon"] } },
    }),
    prisma.kasaHareket.groupBy({ by: ["tip"], _sum: { tutar: true } }),
    prisma.yuk.aggregate({ _sum: { toplamTutar: true, kdvTutar: true } }),
    prisma.gider.aggregate({ _sum: { toplamTutar: true, kdvTutar: true } }),
    aktifBaglam(),
  ]);

  const ayarDeger = (a: string) => ayarlar.find((x) => x.anahtar === a)?.deger || "";

  const kasaBakiye = kasaToplam.reduce(
    (t, h) => (h.tip === "GIRIS" ? t + (h._sum.tutar ?? 0) : t - (h._sum.tutar ?? 0)),
    0
  );

  const isletmeGiderleri = giderler.filter((g) => isletmeGideriMi(g.kategori));
  const aralikta = <T extends { tarih: Date }>(liste: T[], bas: Date, son: Date) =>
    liste.filter((x) => x.tarih >= bas && x.tarih < son);

  const buAyYuk = aralikta(yukler, ayBasi, sonrakiAyBasi);
  const gecenAyYuk = aralikta(yukler, gecenAyBasi, ayBasi);
  const buAyGider = aralikta(isletmeGiderleri, ayBasi, sonrakiAyBasi);
  const gecenAyGider = aralikta(isletmeGiderleri, gecenAyBasi, ayBasi);

  const topla = (l: { toplamTutar: number }[]) => l.reduce((t, x) => t + x.toplamTutar, 0);
  const net = (l: { netTutar: number }[]) => l.reduce((t, x) => t + x.netTutar, 0);

  const gelirToplam = topla(buAyYuk);

  let bekleyenAlacak = 0;
  const yukKalan = new Map<number, number>();
  const alacakliFirmalar = new Set<number>();
  for (const y of bekleyenYukler) {
    const kalan = Math.max(0, y.toplamTutar - y.odemeler.reduce((o, p) => o + p.tutar, 0));
    if (kalan <= 0) continue;
    yukKalan.set(y.id, kalan);
    bekleyenAlacak += kalan;
    alacakliFirmalar.add(y.firmaId);
  }

  const ayEtiket = new Intl.DateTimeFormat("tr-TR", { month: "short" });
  const aylar = Array.from({ length: AY_SAYISI }, (_, i) => {
    const bas = new Date(grafikBasi.getFullYear(), grafikBasi.getMonth() + i, 1);
    const son = new Date(bas.getFullYear(), bas.getMonth() + 1, 1);
    return {
      anahtar: ayParametresi(bas.getFullYear(), bas.getMonth() + 1),
      etiket: ayEtiket.format(bas).replace(".", ""),
      deger: net(aralikta(yukler, bas, son)) - net(aralikta(isletmeGiderleri, bas, son)),
    };
  });

  const buAyTahsil = buAyYuk.reduce((t, y) => t + y.toplamTutar - (yukKalan.get(y.id) ?? 0), 0);

  return (
    <FinansOzetGorunum
      v={{
        ayEtiket: new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(simdi),
        netGelir: net(buAyYuk),
        netGider: net(buAyGider),
        sonuc: net(buAyYuk) - net(buAyGider),
        gecenSonuc: net(gecenAyYuk) - net(gecenAyGider),
        gelirKdvli: gelirToplam,
        giderKdvli: topla(buAyGider),
        aylar,
        tahsil: buAyTahsil,
        tahsilToplam: gelirToplam,
        alacak: bekleyenAlacak,
        alacakFirma: alacakliFirmalar.size,
        kasa: kasaBakiye,
        bugune: {
          gelir: tumYuk._sum.toplamTutar ?? 0,
          gider: tumGider._sum.toplamTutar ?? 0,
          kdv: (tumYuk._sum.kdvTutar ?? 0) - (tumGider._sum.kdvTutar ?? 0),
        },
        excelHref: `/api/excel?ay=${ayParametresi(simdi.getFullYear(), simdi.getMonth() + 1)}`,
        hizliAraTel: ayarDeger("hizli_ara_telefon"),
        muhasebeciTel: ayarDeger("muhasebeci_telefon"),
        uye: baglam.uyeId !== null,
      }}
    />
  );
}
