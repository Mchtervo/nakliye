import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import { koridorIlKumesi } from "@/lib/koridor";
import { aiTercihleriOku } from "@/lib/ayarlar";

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
  /** En sık güzergâh "A → B" */
  baskinGuzergah: string | null;
  /** Haftada ~N ilan (pencereye göre) */
  haftalikSiklik: number;
  /** Her iki uç da koridor dışı */
  koridorDisi: boolean;
  isaretli: boolean;
  sonNot: string | null;
};

export const MUSTERI_ISARET_ANAHTAR = "musteri_isaret";

export function telefonNormalize(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const rakam = tel.replace(/\D/g, "");
  if (rakam.length < 10) return null;
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
  if (girdi.rotaAdet >= 4 && girdi.cikisAdet >= 3) return "KOMISYONCU";
  if (girdi.rotaAdet >= 5) return "KOMISYONCU";
  if (girdi.baskinCikisPay >= 0.65 && girdi.baskinYukPay >= 0.4) {
    return "YUK_SAHIBI";
  }
  if (girdi.baskinCikisPay >= 0.8 && girdi.cikisAdet <= 2) {
    return "YUK_SAHIBI";
  }
  return "KARISIK";
}

export async function musteriIsaretOku(): Promise<Set<string>> {
  const k = await prisma.ayar.findUnique({
    where: { anahtar: MUSTERI_ISARET_ANAHTAR },
  });
  if (!k?.deger) return new Set();
  try {
    const arr = JSON.parse(k.deger) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export async function musteriIsaretToggle(
  telefon: string
): Promise<{ isaretli: boolean }> {
  const tel = telefonNormalize(telefon);
  if (!tel) return { isaretli: false };
  const set = await musteriIsaretOku();
  if (set.has(tel)) set.delete(tel);
  else set.add(tel);
  await prisma.ayar.upsert({
    where: { anahtar: MUSTERI_ISARET_ANAHTAR },
    create: {
      anahtar: MUSTERI_ISARET_ANAHTAR,
      deger: JSON.stringify([...set]),
    },
    update: { deger: JSON.stringify([...set]) },
  });
  return { isaretli: set.has(tel) };
}

export async function musteriNotEkle(
  telefon: string,
  metin: string
): Promise<{ ok: boolean; hata?: string }> {
  const tel = telefonNormalize(telefon);
  const t = metin.trim().slice(0, 500);
  if (!tel) return { ok: false, hata: "Telefon geçersiz" };
  if (!t) return { ok: false, hata: "Not boş" };
  await prisma.musteriNot.create({
    data: { telefon: tel, metin: t },
  });
  return { ok: true };
}

export async function musteriSonNotlar(
  telefonlar: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (telefonlar.length === 0) return map;
  const notlar = await prisma.musteriNot.findMany({
    where: { telefon: { in: telefonlar } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { telefon: true, metin: true },
  });
  for (const n of notlar) {
    if (!map.has(n.telefon)) map.set(n.telefon, n.metin);
  }
  return map;
}

/** Son N günden telefon bazlı müşteri havuzu. */
export async function musteriHavuzuOku(opts?: {
  gun?: number;
  sadeceSahip?: boolean;
}): Promise<MusteriOzet[]> {
  const gun = opts?.gun ?? 60;
  const sinir = new Date(Date.now() - gun * 24 * 60 * 60 * 1000);
  const hafta = Math.max(1, gun / 7);

  const tercih = await aiTercihleriOku();
  const koridor = new Set(koridorIlKumesi(tercih.koridorIller));

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
      kaynak: { select: { tur: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 8000,
  });

  type Kova = {
    telefon: string;
    firmaAdi: string | null;
    rotas: Map<string, number>;
    cikislar: Map<string, number>;
    yukTipleri: Map<string, number>;
    ilanAdet: number;
    sonIlan: Date;
    koridorIci: number;
    koridorDis: number;
    webKaynak: boolean;
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
        rotas: new Map(),
        cikislar: new Map(),
        yukTipleri: new Map(),
        ilanAdet: 0,
        sonIlan: i.createdAt,
        koridorIci: 0,
        koridorDis: 0,
        webKaynak: false,
      };
      map.set(tel, k);
    }
    k.ilanAdet += 1;
    if (i.kaynak?.tur === "WEB") k.webKaynak = true;
    if (i.createdAt > k.sonIlan) k.sonIlan = i.createdAt;
    if (i.firmaAdi && (!k.firmaAdi || k.firmaAdi.length < 3)) {
      k.firmaAdi = i.firmaAdi;
    }
    if (cikis && varis) {
      const rota = `${cikis}|${varis}`;
      k.rotas.set(rota, (k.rotas.get(rota) || 0) + 1);
      const ikiUcta = koridor.has(cikis) || koridor.has(varis);
      if (ikiUcta) k.koridorIci += 1;
      else k.koridorDis += 1;
    }
    if (cikis) k.cikislar.set(cikis, (k.cikislar.get(cikis) || 0) + 1);
    const yt = (i.yukTipi || "").trim().toLocaleLowerCase("tr-TR");
    if (yt) k.yukTipleri.set(yt, (k.yukTipleri.get(yt) || 0) + 1);
  }

  const isaretli = await musteriIsaretOku();
  const telefonlar = [...map.keys()];
  const sonNotlar = await musteriSonNotlar(telefonlar);

  const sonuc: MusteriOzet[] = [];
  for (const k of map.values()) {
    // Tek ilan da yeter (WEB firma+numara hasadı); eskiden <2 eliyordu
    if (k.ilanAdet < 1) continue;
    const baskinCikis = baskinAnahtar(k.cikislar);
    const baskinYuk = baskinAnahtar(k.yukTipleri);
    const baskinRota = baskinAnahtar(k.rotas);
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

    const guzergah = baskinRota
      ? baskinRota.replace("|", " → ")
      : null;

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
      baskinGuzergah: guzergah,
      haftalikSiklik: Math.round((k.ilanAdet / hafta) * 10) / 10,
      koridorDisi: k.koridorDis > 0 && k.koridorIci === 0,
      isaretli: isaretli.has(k.telefon),
      sonNot: sonNotlar.get(k.telefon) ?? null,
    });
  }

  // YÜK SAHİBİ önce, sonra sıklığa göre azalan
  sonuc.sort((a, b) => {
    if (a.sinif === "YUK_SAHIBI" && b.sinif !== "YUK_SAHIBI") return -1;
    if (b.sinif === "YUK_SAHIBI" && a.sinif !== "YUK_SAHIBI") return 1;
    if (a.isaretli !== b.isaretli) return a.isaretli ? -1 : 1;
    return b.haftalikSiklik - a.haftalikSiklik || b.ilanAdet - a.ilanAdet;
  });

  return sonuc;
}

export function telefonGorunum(tel10: string): string {
  if (tel10.length !== 10) return tel10;
  return `0${tel10.slice(0, 3)} ${tel10.slice(3, 6)} ${tel10.slice(6)}`;
}
