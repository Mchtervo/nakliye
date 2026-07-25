import { prisma } from "@/lib/prisma";
import { ayAraligi } from "@/lib/tarih";
import { demirbasMi, kategoriAdi } from "@/lib/sabitler";

export type KdvKategoriSatiri = {
  kod: string;
  ad: string;
  kdv: number;
  net: number;
  adet: number;
};

export type KdvDonemi = {
  yil: number;
  ay: number;
  /** Yük faturalarındaki KDV — devlete borç. */
  hesaplananKdv: number;
  /** Gider faturalarındaki KDV — borçtan düşülür. */
  indirilecekKdv: number;
  /** İndirilecek KDV'nin demirbaştan gelen kısmı (bilgi amaçlı). */
  demirbasKdv: number;
  /** Hesaplanan > indirilecek ise ödenecek tutar. */
  odenecekKdv: number;
  /** İndirilecek > hesaplanan ise sonraki aya devreden tutar. */
  devredenKdv: number;
  gelirNet: number;
  giderNet: number;
  yukAdet: number;
  giderAdet: number;
  kdvsizYukAdet: number;
  kdvsizGiderAdet: number;
  kategoriler: KdvKategoriSatiri[];
};

export async function kdvDonemiHesapla(
  yil: number,
  ay: number
): Promise<KdvDonemi> {
  const { bas, son } = ayAraligi(yil, ay);

  const [yukler, giderler] = await Promise.all([
    prisma.yuk.findMany({
      where: { tarih: { gte: bas, lt: son } },
      select: { netTutar: true, kdvTutar: true, kdvli: true },
    }),
    prisma.gider.findMany({
      where: { tarih: { gte: bas, lt: son } },
      select: { netTutar: true, kdvTutar: true, kdvli: true, kategori: true },
    }),
  ]);

  const hesaplananKdv = yukler.reduce((t, y) => t + y.kdvTutar, 0);
  const indirilecekKdv = giderler.reduce((t, g) => t + g.kdvTutar, 0);
  const demirbasKdv = giderler
    .filter((g) => demirbasMi(g.kategori))
    .reduce((t, g) => t + g.kdvTutar, 0);

  const fark = hesaplananKdv - indirilecekKdv;

  const katMap = new Map<string, KdvKategoriSatiri>();
  for (const g of giderler) {
    if (g.kdvTutar <= 0) continue;
    const mevcut = katMap.get(g.kategori);
    if (mevcut) {
      mevcut.kdv += g.kdvTutar;
      mevcut.net += g.netTutar;
      mevcut.adet += 1;
    } else {
      katMap.set(g.kategori, {
        kod: g.kategori,
        ad: kategoriAdi(g.kategori),
        kdv: g.kdvTutar,
        net: g.netTutar,
        adet: 1,
      });
    }
  }

  return {
    yil,
    ay,
    hesaplananKdv,
    indirilecekKdv,
    demirbasKdv,
    odenecekKdv: Math.max(0, fark),
    devredenKdv: Math.max(0, -fark),
    gelirNet: yukler.reduce((t, y) => t + y.netTutar, 0),
    giderNet: giderler.reduce((t, g) => t + g.netTutar, 0),
    yukAdet: yukler.length,
    giderAdet: giderler.length,
    kdvsizYukAdet: yukler.filter((y) => !y.kdvli).length,
    kdvsizGiderAdet: giderler.filter((g) => !g.kdvli).length,
    kategoriler: [...katMap.values()].sort((a, b) => b.kdv - a.kdv),
  };
}

/** Son N ayın KDV özeti (grafik / trend için, en eskiden yeniye). */
export async function sonAylarKdv(
  adet: number,
  bitisYil: number,
  bitisAy: number
): Promise<KdvDonemi[]> {
  const donemler: { yil: number; ay: number }[] = [];
  for (let i = adet - 1; i >= 0; i--) {
    const d = new Date(bitisYil, bitisAy - 1 - i, 1);
    donemler.push({ yil: d.getFullYear(), ay: d.getMonth() + 1 });
  }
  return Promise.all(donemler.map((d) => kdvDonemiHesapla(d.yil, d.ay)));
}

export function ayEtiketi(yil: number, ay: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(yil, ay - 1, 1));
}

export function ayKisaEtiketi(yil: number, ay: number): string {
  return new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(
    new Date(yil, ay - 1, 1)
  );
}

/** "2026-07" biçimindeki parametreyi güvenli şekilde okur. */
export function ayParametresiOku(deger: string | undefined): {
  yil: number;
  ay: number;
} {
  const simdi = new Date();
  if (deger && /^\d{4}-\d{2}$/.test(deger)) {
    const [y, a] = deger.split("-").map(Number);
    if (a >= 1 && a <= 12 && y >= 2000 && y <= 2999) return { yil: y, ay: a };
  }
  return { yil: simdi.getFullYear(), ay: simdi.getMonth() + 1 };
}

export function ayParametresi(yil: number, ay: number): string {
  return `${yil}-${String(ay).padStart(2, "0")}`;
}
