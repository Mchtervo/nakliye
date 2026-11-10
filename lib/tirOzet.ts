import { prisma } from "@/lib/prisma";
import { isletmeGideriMi } from "@/lib/sabitler";

export type TirSatiri = {
  id: number;
  /** Plaka (yoksa "Tır 1") */
  etiket: string;
  sofor: string | null;
  /** KDV hariç */
  gelir: number;
  /** İşletme gideri (demirbaş hariç), KDV hariç */
  gider: number;
  sefer: number;
};

/**
 * Tarih aralığında tır (şoför) bazlı gelir / gider. Araç alanı boş eski
 * kayıtlar ilk tıra yazılır (çoklu araçtan önce tek araç vardı).
 */
export async function tirBazliOzet(bas: Date, son: Date): Promise<TirSatiri[]> {
  const [araclar, yukler, giderler] = await Promise.all([
    prisma.arac.findMany({ orderBy: { id: "asc" }, select: { id: true, ad: true, plaka: true, sofor: true } }),
    prisma.yuk.findMany({ where: { tarih: { gte: bas, lt: son } }, select: { netTutar: true, aracId: true } }),
    prisma.gider.findMany({ where: { tarih: { gte: bas, lt: son } }, select: { netTutar: true, aracId: true, kategori: true } }),
  ]);
  if (araclar.length === 0) return [];
  const ilkId = araclar[0].id;
  const satirlar = new Map<number, TirSatiri>(
    araclar.map((a, i) => [a.id, { id: a.id, etiket: a.plaka || `${a.ad} ${i + 1}`, sofor: a.sofor, gelir: 0, gider: 0, sefer: 0 }])
  );
  const bul = (id: number | null) => satirlar.get(id ?? ilkId) ?? satirlar.get(ilkId)!;
  for (const y of yukler) {
    const s = bul(y.aracId);
    s.gelir += y.netTutar;
    s.sefer += 1;
  }
  for (const g of giderler) {
    if (isletmeGideriMi(g.kategori)) bul(g.aracId).gider += g.netTutar;
  }
  return [...satirlar.values()];
}

/** Satırların toplamı ("Hepsi" satırı). */
export function tirToplami(satirlar: TirSatiri[]): TirSatiri {
  return satirlar.reduce(
    (t, s) => ({ ...t, gelir: t.gelir + s.gelir, gider: t.gider + s.gider, sefer: t.sefer + s.sefer }),
    { id: 0, etiket: "Tüm tırlar", sofor: null, gelir: 0, gider: 0, sefer: 0 }
  );
}
