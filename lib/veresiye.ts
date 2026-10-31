/**
 * Veresiye defteri: veresiye yazılan giderler (çoğunlukla yakıt) istasyon /
 * dükkân bazında toplanır, o yere yapılan ödemeler düşülür.
 * Gider ay sonunda alındığı ay sayılır; veresiye ödemesi ayrıca gider değildir.
 */
import { prisma } from "@/lib/prisma";

const anahtar = (yer: string) => yer.trim().toLocaleLowerCase("tr-TR");

export type VeresiyeAlim = {
  id: number;
  tarih: Date;
  kategori: string;
  tutar: number;
  litre: number | null;
};

export type VeresiyeYeri = {
  yer: string;
  alinan: number;
  odenen: number;
  kalan: number;
  sonHareket: Date;
  alimlar: VeresiyeAlim[];
  odemeler: { id: number; tarih: Date; tutar: number }[];
};

export async function veresiyeDurumu(): Promise<VeresiyeYeri[]> {
  const [giderler, odemeler] = await Promise.all([
    prisma.gider.findMany({
      where: { odeme: "VERESIYE", veresiyeYer: { not: null } },
      select: { id: true, tarih: true, kategori: true, toplamTutar: true, litre: true, veresiyeYer: true },
      orderBy: { tarih: "desc" },
    }),
    prisma.veresiyeOdeme.findMany({ orderBy: { tarih: "desc" } }),
  ]);

  const yerler = new Map<string, VeresiyeYeri>();
  const al = (yer: string, tarih: Date) => {
    const k = anahtar(yer);
    let v = yerler.get(k);
    if (!v) {
      v = { yer: yer.trim(), alinan: 0, odenen: 0, kalan: 0, sonHareket: tarih, alimlar: [], odemeler: [] };
      yerler.set(k, v);
    }
    if (tarih > v.sonHareket) v.sonHareket = tarih;
    return v;
  };

  for (const g of giderler) {
    const v = al(g.veresiyeYer!, g.tarih);
    v.alinan += g.toplamTutar;
    v.alimlar.push({ id: g.id, tarih: g.tarih, kategori: g.kategori, tutar: g.toplamTutar, litre: g.litre });
  }
  for (const o of odemeler) {
    const v = al(o.yer, o.tarih);
    v.odenen += o.tutar;
    v.odemeler.push({ id: o.id, tarih: o.tarih, tutar: o.tutar });
  }

  return [...yerler.values()]
    .map((v) => ({ ...v, kalan: Math.max(0, v.alinan - v.odenen) }))
    .sort((a, b) => b.kalan - a.kalan || b.sonHareket.getTime() - a.sonHareket.getTime());
}

/** Formdaki öneri listesi için bilinen yer adları (son kullanılan önce). */
export async function veresiyeYerleri(): Promise<string[]> {
  const satirlar = await prisma.gider.findMany({
    where: { odeme: "VERESIYE", veresiyeYer: { not: null } },
    select: { veresiyeYer: true },
    orderBy: { tarih: "desc" },
    take: 200,
  });
  const gorulen = new Map<string, string>();
  for (const s of satirlar) {
    const k = anahtar(s.veresiyeYer!);
    if (!gorulen.has(k)) gorulen.set(k, s.veresiyeYer!.trim());
  }
  return [...gorulen.values()].slice(0, 20);
}
