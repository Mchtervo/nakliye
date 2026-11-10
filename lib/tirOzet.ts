import { prisma } from "@/lib/prisma";
import { isletmeGideriMi } from "@/lib/sabitler";
import type { TirSatiri } from "@/lib/tirHesap";

export { tirHesabi, tirToplami, type TirSatiri } from "@/lib/tirHesap";

/**
 * Tarih aralığında tır (şoför) bazlı gelir / gider / KDV. Araç alanı boş eski
 * kayıtlar ilk tıra yazılır (çoklu araçtan önce tek araç vardı).
 */
export async function tirBazliOzet(bas: Date, son: Date): Promise<TirSatiri[]> {
  const [araclar, yukler, giderler] = await Promise.all([
    prisma.arac.findMany({ orderBy: { id: "asc" }, select: { id: true, ad: true, plaka: true, sofor: true } }),
    prisma.yuk.findMany({ where: { tarih: { gte: bas, lt: son } }, select: { netTutar: true, kdvTutar: true, aracId: true } }),
    prisma.gider.findMany({ where: { tarih: { gte: bas, lt: son } }, select: { netTutar: true, kdvTutar: true, aracId: true, kategori: true } }),
  ]);
  if (araclar.length === 0) return [];
  const ilkId = araclar[0].id;
  const satirlar = new Map<number, TirSatiri>(
    araclar.map((a, i) => [
      a.id,
      { id: a.id, etiket: a.plaka || `${a.ad} ${i + 1}`, sofor: a.sofor, gelir: 0, gelirKdv: 0, gider: 0, giderKdv: 0, sefer: 0 },
    ])
  );
  const bul = (id: number | null) => satirlar.get(id ?? ilkId) ?? satirlar.get(ilkId)!;
  for (const y of yukler) {
    const s = bul(y.aracId);
    s.gelir += y.netTutar;
    s.gelirKdv += y.kdvTutar;
    s.sefer += 1;
  }
  for (const g of giderler) {
    const s = bul(g.aracId);
    s.giderKdv += g.kdvTutar;
    if (isletmeGideriMi(g.kategori)) s.gider += g.netTutar;
  }
  return [...satirlar.values()];
}
