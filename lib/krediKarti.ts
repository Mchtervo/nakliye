/**
 * Kredi kartı borç takibi ve ay sonu net kalan (nakit görünüm, KDV dahil).
 * Kart kalan borcu = ekstre borcu − ekstre girildikten sonraki ödemeler.
 */
import { prisma } from "@/lib/prisma";
import { demirbasMi } from "@/lib/sabitler";

const GUN_MS = 24 * 60 * 60 * 1000;

/** Bu ayın son ödeme günü geçmediyse bu ay, geçtiyse gelecek ay (kısa ayda son gün). */
export function sonrakiSonOdeme(gun: number, simdi = new Date()): Date {
  const tarihYap = (yil: number, ay: number) => {
    const ayinSonu = new Date(yil, ay + 1, 0).getDate();
    return new Date(yil, ay, Math.min(gun, ayinSonu));
  };
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  const buAy = tarihYap(simdi.getFullYear(), simdi.getMonth());
  return buAy >= bugun ? buAy : tarihYap(simdi.getFullYear(), simdi.getMonth() + 1);
}

export function gunFarki(tarih: Date, simdi = new Date()): number {
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  return Math.round((tarih.getTime() - bugun.getTime()) / GUN_MS);
}

export type KartDurumu = {
  id: number;
  ad: string;
  sonOdemeGunu: number;
  borc: number;
  odenen: number;
  kalan: number;
  sonOdeme: Date;
  kalanGun: number;
  uyari: string | null;
};

export async function kartlarDurumu(simdi = new Date()): Promise<KartDurumu[]> {
  const kartlar = await prisma.krediKarti.findMany({
    orderBy: { id: "asc" },
    include: { odemeler: { select: { tarih: true, tutar: true } } },
  });
  return kartlar.map((k) => {
    const odenen = k.odemeler.filter((o) => o.tarih >= k.borcTarih).reduce((t, o) => t + o.tutar, 0);
    const kalan = Math.max(0, k.borc - odenen);
    // Borç kalmışsa son ödeme, ekstrenin girildiği günden sonraki ilk son ödeme
    // günüdür; geçtiyse gecikme olarak kalır (ay dönünce "24 gün kaldı" demez).
    // Borç bittiyse bir sonraki ayın son ödeme günü gösterilir.
    const sonOdeme =
      kalan > 0 ? sonrakiSonOdeme(k.sonOdemeGunu, k.borcTarih) : sonrakiSonOdeme(k.sonOdemeGunu, simdi);
    return {
      id: k.id,
      ad: k.ad,
      sonOdemeGunu: k.sonOdemeGunu,
      borc: k.borc,
      odenen,
      kalan,
      sonOdeme,
      kalanGun: gunFarki(sonOdeme, simdi),
      uyari: k.uyari,
    };
  });
}

export type AyNet = {
  anahtar: string;
  etiket: string;
  gelir: number;
  yakit: number;
  kredi: number;
  kart: number;
  diger: number;
  net: number;
};

/**
 * Son `adet` ay: kazanç (sefer, KDV dahil) − yakıt − kredi taksiti − kart
 * ödemesi − diğer giderler. Demirbaş (tır/dorse alımı) yatırım, ayrı tutulur.
 * Kart ödemesi ve kartla ödenmiş gider ikisi birden girilirse iki kez düşer.
 */
export async function ayNetleri(adet = 6, simdi = new Date()): Promise<AyNet[]> {
  const bas = new Date(simdi.getFullYear(), simdi.getMonth() - (adet - 1), 1);
  const [yukler, giderler, kartOdemeleri] = await Promise.all([
    prisma.yuk.findMany({ where: { tarih: { gte: bas } }, select: { tarih: true, toplamTutar: true } }),
    prisma.gider.findMany({ where: { tarih: { gte: bas } }, select: { tarih: true, toplamTutar: true, kategori: true } }),
    prisma.kartOdeme.findMany({ where: { tarih: { gte: bas } }, select: { tarih: true, tutar: true } }),
  ]);
  const etiketci = new Intl.DateTimeFormat("tr-TR", { month: "long" });
  return Array.from({ length: adet }, (_, i) => {
    const ayBas = new Date(bas.getFullYear(), bas.getMonth() + i, 1);
    const aySon = new Date(ayBas.getFullYear(), ayBas.getMonth() + 1, 1);
    const icinde = (t: Date) => t >= ayBas && t < aySon;
    const g = giderler.filter((x) => icinde(x.tarih) && !demirbasMi(x.kategori));
    const topla = (l: { toplamTutar: number }[]) => l.reduce((t, x) => t + x.toplamTutar, 0);
    const gelir = topla(yukler.filter((y) => icinde(y.tarih)));
    const yakit = topla(g.filter((x) => x.kategori === "YAKIT"));
    const kredi = topla(g.filter((x) => x.kategori === "KREDI_ODEME"));
    const diger = topla(g.filter((x) => x.kategori !== "YAKIT" && x.kategori !== "KREDI_ODEME"));
    const kart = kartOdemeleri.filter((o) => icinde(o.tarih)).reduce((t, o) => t + o.tutar, 0);
    return {
      anahtar: `${ayBas.getFullYear()}-${ayBas.getMonth() + 1}`,
      etiket: etiketci.format(ayBas),
      gelir,
      yakit,
      kredi,
      kart,
      diger,
      net: gelir - yakit - kredi - kart - diger,
    };
  });
}
