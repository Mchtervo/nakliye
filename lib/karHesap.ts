import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import { yaklasikKarayoluKm } from "@/lib/ilMesafe";
import { tlYazKisa } from "@/lib/para";

/** Varsayılanlar — Ayarlar’dan ezilir. */
export const VARSAYILAN_MALIYET = {
  /** lt / 100 km */
  yakitLt100: 32,
  /** ₺ / litre motorin */
  motorinTl: 48,
  /** ₺ / km sabit (lastik, bakım, amortisman payı) */
  sabitTlKm: 2.5,
  /** ₺ / km HGS tahmini */
  hgsTlKm: 0.2,
} as const;

export type MaliyetAyarlari = {
  yakitLt100: number;
  motorinTl: number;
  sabitTlKm: number;
  hgsTlKm: number;
};

export type KarOzet = {
  mesafeKm: number | null;
  yakitTl: number | null;
  hgsTl: number | null;
  sabitTl: number | null;
  maliyetTl: number | null;
  gelirTl: number | null;
  netTl: number | null;
  tlKm: number | null;
  /** Yuk tablosu hat ortalaması (₺, KDV dahil toplam) */
  hatOrtalamaTl: number | null;
  hatOrnek: number;
  /** Pozitif = ortalamanın %X altında */
  ortalamaAltindaYuzde: number | null;
};

export function gelirKurus(ilan: {
  ucret: number | null;
  fiyatTon: number | null;
  tonaj: number | null;
}): number {
  if (ilan.ucret && ilan.ucret > 0) return ilan.ucret;
  if (ilan.fiyatTon && ilan.tonaj && ilan.fiyatTon > 0 && ilan.tonaj > 0) {
    return ilan.fiyatTon * ilan.tonaj;
  }
  return 0;
}

export function karHesapla(
  ilan: {
    cikisIl: string | null;
    varisIl: string | null;
    ucret: number | null;
    fiyatTon: number | null;
    tonaj: number | null;
  },
  maliyet: MaliyetAyarlari,
  hat?: { ortalamaKurus: number; ornek: number } | null
): KarOzet {
  const mesafeKm = yaklasikKarayoluKm(ilan.cikisIl, ilan.varisIl);
  const gelir = gelirKurus(ilan);
  const gelirTl = gelir > 0 ? gelir / 100 : null;

  if (mesafeKm === null || mesafeKm <= 0) {
    return {
      mesafeKm,
      yakitTl: null,
      hgsTl: null,
      sabitTl: null,
      maliyetTl: null,
      gelirTl,
      netTl: null,
      tlKm: null,
      hatOrtalamaTl: hat && hat.ornek > 0 ? hat.ortalamaKurus / 100 : null,
      hatOrnek: hat?.ornek ?? 0,
      ortalamaAltindaYuzde: null,
    };
  }

  const yakitLt = (mesafeKm * maliyet.yakitLt100) / 100;
  const yakitTl = yakitLt * maliyet.motorinTl;
  const hgsTl = mesafeKm * maliyet.hgsTlKm;
  const sabitTl = mesafeKm * maliyet.sabitTlKm;
  const maliyetTl = yakitTl + hgsTl + sabitTl;
  const netTl = gelirTl !== null ? gelirTl - maliyetTl : null;
  const tlKm = netTl !== null ? netTl / mesafeKm : null;

  let ortalamaAltindaYuzde: number | null = null;
  const hatOrtalamaTl =
    hat && hat.ornek > 0 ? hat.ortalamaKurus / 100 : null;
  if (gelirTl !== null && hatOrtalamaTl && hatOrtalamaTl > 0) {
    const fark = ((hatOrtalamaTl - gelirTl) / hatOrtalamaTl) * 100;
    if (fark >= 5) ortalamaAltindaYuzde = Math.round(fark);
  }

  return {
    mesafeKm,
    yakitTl: Math.round(yakitTl),
    hgsTl: Math.round(hgsTl),
    sabitTl: Math.round(sabitTl),
    maliyetTl: Math.round(maliyetTl),
    gelirTl: gelirTl !== null ? Math.round(gelirTl) : null,
    netTl: netTl !== null ? Math.round(netTl) : null,
    tlKm: tlKm !== null ? Math.round(tlKm * 10) / 10 : null,
    hatOrtalamaTl: hatOrtalamaTl !== null ? Math.round(hatOrtalamaTl) : null,
    hatOrnek: hat?.ornek ?? 0,
    ortalamaAltindaYuzde,
  };
}

export function karOzetYazi(k: KarOzet): {
  mesafe: string | null;
  yakit: string | null;
  hgs: string | null;
  net: string | null;
  tlKm: string | null;
  uyari: string | null;
} {
  const tl = (n: number) => `₺${n.toLocaleString("tr-TR")}`;
  return {
    mesafe: k.mesafeKm !== null ? `~${k.mesafeKm} km` : null,
    yakit: k.yakitTl !== null ? tl(k.yakitTl) : null,
    hgs: k.hgsTl !== null ? tl(k.hgsTl) : null,
    net: k.netTl !== null ? tl(k.netTl) : null,
    tlKm: k.tlKm !== null ? `₺${k.tlKm}/km` : null,
    uyari:
      k.ortalamaAltindaYuzde !== null && k.hatOrtalamaTl !== null
        ? `Bu fiyat hat ortalamanın %${k.ortalamaAltindaYuzde} altında (ort. ${tlYazKisa(Math.round(k.hatOrtalamaTl * 100))}, ${k.hatOrnek} sefer)`
        : null,
  };
}

/**
 * Yuk tablosundan (SADECE OKU) il→il hat ortalamaları.
 * Anahtar: "Ankara|İstanbul"
 */
export async function hatOrtalamalariYukle(): Promise<
  Map<string, { ortalamaKurus: number; ornek: number }>
> {
  const yukler = await prisma.yuk.findMany({
    select: { nereden: true, nereye: true, toplamTutar: true },
    orderBy: { tarih: "desc" },
    take: 800,
  });

  const kova = new Map<string, { toplam: number; n: number }>();
  for (const y of yukler) {
    const a = ilBul(y.nereden);
    const b = ilBul(y.nereye);
    if (!a || !b || a === b) continue;
    if (!y.toplamTutar || y.toplamTutar <= 0) continue;
    const key = `${a}|${b}`;
    const onceki = kova.get(key) || { toplam: 0, n: 0 };
    onceki.toplam += y.toplamTutar;
    onceki.n += 1;
    kova.set(key, onceki);
  }

  const sonuc = new Map<string, { ortalamaKurus: number; ornek: number }>();
  for (const [key, v] of kova) {
    if (v.n < 1) continue;
    sonuc.set(key, {
      ortalamaKurus: Math.round(v.toplam / v.n),
      ornek: v.n,
    });
  }
  return sonuc;
}

export function hatAnahtar(
  cikisIl: string | null | undefined,
  varisIl: string | null | undefined
): string | null {
  const a = ilBul(cikisIl);
  const b = ilBul(varisIl);
  if (!a || !b) return null;
  return `${a}|${b}`;
}
