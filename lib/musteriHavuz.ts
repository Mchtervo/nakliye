import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";

export type MusteriSinif = "YUK_SAHIBI" | "KOMISYONCU" | "KARISIK";

export type MusteriOzet = {
  telefon: string;
  firmaAdi: string | null;
  sinif: MusteriSinif;
  cikisIl: string | null;
  yukTipi: string | null;
  ilanAdet: number;
  rotaAdet: number;
  sonIlan: Date;
  /** En sık çıkış */
  baskinCikis: string | null;
  baskinYukTipi: string | null;
};

function telefonNormalize(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const rakam = tel.replace(/\D/g, "");
  if (rakam.length < 10) return null;
  // Son 10 hane (0XXXXXXXXXX)
  return rakam.slice(-10);
}

function baskinAnahtar(sayac: Map<string, number>): string | null {
  let enIyi: string | null = null;
  let enCok = 0;
  for (const [k, n] of sayac) {
    if (n > enCok) {
      enCok = n;
      enIyi = k;
    }
  }
  return enIyi;
}

/**
 * Aynı telefondan çok farklı güzergâh → komisyoncu.
 * Hep aynı çıkış + benzer yük tipi → yük sahibi (doğrudan müşteri).
 */
export function siniflandir(girdi: {
  rotaAdet: number;
  cikisAdet: number;
  ilanAdet: number;
  baskinCikisPay: number;
  baskinYukPay: number;
}): MusteriSinif {
  if (girdi.ilanAdet < 3) return "KARISIK";
  // Komisyoncu: birçok rota / birçok çıkış
  if (girdi.rotaAdet >= 4 && girdi.cikisAdet >= 3) return "KOMISYONCU";
  if (girdi.rotaAdet >= 5) return "KOMISYONCU";
  // Yük sahibi: baskın çıkış + (baskın yük veya az çeşit)
  if (girdi.baskinCikisPay >= 0.65 && girdi.baskinYukPay >= 0.4) {
    return "YUK_SAHIBI";
  }
  if (girdi.baskinCikisPay >= 0.8 && girdi.cikisAdet <= 2) {
    return "YUK_SAHIBI";
  }
  return "KARISIK";
}

/** Son N günden telefon bazlı müşteri havuzu (YukIlani — sadece okuma). */
export async function musteriHavuzuOku(opts?: {
  gun?: number;
  sadeceSahip?: boolean;
}): Promise<MusteriOzet[]> {
  const gun = opts?.gun ?? 60;
  const sinir = new Date(Date.now() - gun * 24 * 60 * 60 * 1000);

  const ilanlar = await prisma.yukIlani.findMany({
    where: {
      telefon: { not: null },
      createdAt: { gte: sinir },
      guvenSkoru: { gte: 40 },
    },
    select: {
      telefon: true,
      firmaAdi: true,
      cikisIl: true,
      varisIl: true,
      nereden: true,
      yukTipi: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 4000,
  });

  type Kova = {
    telefon: string;
    firmaAdi: string | null;
    rotas: Set<string>;
    cikislar: Map<string, number>;
    yukTipleri: Map<string, number>;
    ilanAdet: number;
    sonIlan: Date;
  };

  const map = new Map<string, Kova>();

  for (const i of ilanlar) {
    const tel = telefonNormalize(i.telefon);
    if (!tel) continue;
    const cikis = ilBul(i.cikisIl) || ilBul(i.nereden);
    const varis = ilBul(i.varisIl);
    let k = map.get(tel);
    if (!k) {
      k = {
        telefon: tel,
        firmaAdi: i.firmaAdi,
        rotas: new Set(),
        cikislar: new Map(),
        yukTipleri: new Map(),
        ilanAdet: 0,
        sonIlan: i.createdAt,
      };
      map.set(tel, k);
    }
    k.ilanAdet += 1;
    if (i.createdAt > k.sonIlan) k.sonIlan = i.createdAt;
    if (i.firmaAdi && !k.firmaAdi) k.firmaAdi = i.firmaAdi;
    if (cikis && varis) k.rotas.add(`${cikis}|${varis}`);
    if (cikis) k.cikislar.set(cikis, (k.cikislar.get(cikis) || 0) + 1);
    const yt = (i.yukTipi || "").trim().toLocaleLowerCase("tr-TR");
    if (yt) k.yukTipleri.set(yt, (k.yukTipleri.get(yt) || 0) + 1);
  }

  const sonuc: MusteriOzet[] = [];
  for (const k of map.values()) {
    if (k.ilanAdet < 2) continue;
    const baskinCikis = baskinAnahtar(k.cikislar);
    const baskinYuk = baskinAnahtar(k.yukTipleri);
    const baskinCikisPay = baskinCikis
      ? (k.cikislar.get(baskinCikis) || 0) / k.ilanAdet
      : 0;
    const baskinYukPay = baskinYuk
      ? (k.yukTipleri.get(baskinYuk) || 0) / k.ilanAdet
      : 0;

    const sinif = siniflandir({
      rotaAdet: k.rotas.size,
      cikisAdet: k.cikislar.size,
      ilanAdet: k.ilanAdet,
      baskinCikisPay,
      baskinYukPay,
    });

    if (opts?.sadeceSahip && sinif !== "YUK_SAHIBI") continue;

    sonuc.push({
      telefon: k.telefon,
      firmaAdi: k.firmaAdi,
      sinif,
      cikisIl: baskinCikis,
      yukTipi: baskinYuk,
      ilanAdet: k.ilanAdet,
      rotaAdet: k.rotas.size,
      sonIlan: k.sonIlan,
      baskinCikis,
      baskinYukTipi: baskinYuk,
    });
  }

  sonuc.sort((a, b) => {
    if (a.sinif === "YUK_SAHIBI" && b.sinif !== "YUK_SAHIBI") return -1;
    if (b.sinif === "YUK_SAHIBI" && a.sinif !== "YUK_SAHIBI") return 1;
    return b.ilanAdet - a.ilanAdet;
  });

  return sonuc;
}

export function telefonGorunum(tel10: string): string {
  if (tel10.length !== 10) return tel10;
  return `0${tel10.slice(0, 3)} ${tel10.slice(3, 6)} ${tel10.slice(6)}`;
}
