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
  /** İstiap haddi (ton) — üstü tonaj aşımı */
  tonaj: 26,
} as const;

export type MaliyetAyarlari = {
  yakitLt100: number;
  motorinTl: number;
  sabitTlKm: number;
  hgsTlKm: number;
  /** İstiap haddi (ton) */
  tonaj: number;
};

export type KarOzet = {
  mesafeKm: number | null;
  /** Boş (reposition) km — varsa maliyete eklenir */
  bosKm: number;
  yakitTl: number | null;
  hgsTl: number | null;
  sabitTl: number | null;
  /** Boş km maliyeti (₺) */
  bosMaliyetTl: number | null;
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

/** km başına yakıt+HGS+sabit (₺). */
export function kmMaliyetTl(mesafeKm: number, maliyet: MaliyetAyarlari): number {
  if (mesafeKm <= 0) return 0;
  const yakitLt = (mesafeKm * maliyet.yakitLt100) / 100;
  return (
    yakitLt * maliyet.motorinTl +
    mesafeKm * maliyet.hgsTlKm +
    mesafeKm * maliyet.sabitTlKm
  );
}

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
  hat?: { ortalamaKurus: number; ornek: number } | null,
  /** Boş km (önceki varış → bu çıkış); yüklü km’den ayrı hesaplanır */
  opts?: { bosKm?: number }
): KarOzet {
  const mesafeKm = yaklasikKarayoluKm(ilan.cikisIl, ilan.varisIl);
  const bosKm = Math.max(0, opts?.bosKm ?? 0);
  const gelir = gelirKurus(ilan);
  const gelirTl = gelir > 0 ? gelir / 100 : null;
  const hatOrtalamaTl =
    hat && hat.ornek > 0 ? hat.ortalamaKurus / 100 : null;

  if ((mesafeKm === null || mesafeKm <= 0) && bosKm <= 0) {
    return {
      mesafeKm,
      bosKm,
      yakitTl: null,
      hgsTl: null,
      sabitTl: null,
      bosMaliyetTl: null,
      maliyetTl: null,
      gelirTl,
      netTl: null,
      tlKm: null,
      hatOrtalamaTl,
      hatOrnek: hat?.ornek ?? 0,
      ortalamaAltindaYuzde: null,
    };
  }

  const yukluKm = mesafeKm !== null && mesafeKm > 0 ? mesafeKm : 0;
  const yakitLt = (yukluKm * maliyet.yakitLt100) / 100;
  const yakitTl = yakitLt * maliyet.motorinTl;
  const hgsTl = yukluKm * maliyet.hgsTlKm;
  const sabitTl = yukluKm * maliyet.sabitTlKm;
  const yukluMaliyetTl = yakitTl + hgsTl + sabitTl;
  const bosMaliyetTl = kmMaliyetTl(bosKm, maliyet);
  const maliyetTl = yukluMaliyetTl + bosMaliyetTl;
  const netTl = gelirTl !== null ? gelirTl - maliyetTl : null;
  const toplamKm = yukluKm + bosKm;
  const tlKm = netTl !== null && toplamKm > 0 ? netTl / toplamKm : null;

  let ortalamaAltindaYuzde: number | null = null;
  if (gelirTl !== null && hatOrtalamaTl && hatOrtalamaTl > 0) {
    const fark = ((hatOrtalamaTl - gelirTl) / hatOrtalamaTl) * 100;
    if (fark >= 5) ortalamaAltindaYuzde = Math.round(fark);
  }

  return {
    mesafeKm: mesafeKm !== null && mesafeKm > 0 ? mesafeKm : null,
    bosKm,
    yakitTl: Math.round(yakitTl),
    hgsTl: Math.round(hgsTl),
    sabitTl: Math.round(sabitTl),
    bosMaliyetTl: Math.round(bosMaliyetTl),
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
let hatCache: {
  at: number;
  data: Map<string, { ortalamaKurus: number; ornek: number }>;
} | null = null;

export async function hatOrtalamalariYukle(): Promise<
  Map<string, { ortalamaKurus: number; ornek: number }>
> {
  // Sayfa geçişlerinde 800 satır tekrar çekilmesin
  const SIMDI = Date.now();
  if (hatCache && SIMDI - hatCache.at < 5 * 60_000) {
    return hatCache.data;
  }

  const yukler = await prisma.yuk.findMany({
    select: { nereden: true, nereye: true, toplamTutar: true },
    orderBy: { tarih: "desc" },
    take: 250,
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
  hatCache = { at: SIMDI, data: sonuc };
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
