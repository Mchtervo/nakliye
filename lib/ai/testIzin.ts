import { prisma } from "@/lib/prisma";

/** Tek kullanımlık test izni — AI_KAPALI iken bile 1 test için. */
export const TEST_IZIN_ANAHTAR = "ai_test_izin";

/** Varsayılan test tavanı (USD). Mesaj sayısı değil, harcama sınırı. */
export const TEST_TAVAN_USD_VARSAYILAN = 0.05;

type IzinKayit = {
  kalan: number;
  bitisMs: number;
  /** İzin verirken belirlenen tavan (USD). */
  tavanUsd: number;
  /** Tüketilmiş turda biriken harcama (mikrodolar). */
  harcamaMikro?: number;
  tuketildiMs?: number;
};

async function oku(): Promise<IzinKayit | null> {
  const k = await prisma.ayar.findUnique({
    where: { anahtar: TEST_IZIN_ANAHTAR },
  });
  if (!k?.deger) return null;
  try {
    return JSON.parse(k.deger) as IzinKayit;
  } catch {
    return null;
  }
}

async function yaz(d: IzinKayit | null): Promise<void> {
  if (!d) {
    await prisma.ayar.delete({ where: { anahtar: TEST_IZIN_ANAHTAR } }).catch(
      () => null
    );
    return;
  }
  await prisma.ayar.upsert({
    where: { anahtar: TEST_IZIN_ANAHTAR },
    create: { anahtar: TEST_IZIN_ANAHTAR, deger: JSON.stringify(d) },
    update: { deger: JSON.stringify(d) },
  });
}

function tavanNormalize(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return TEST_TAVAN_USD_VARSAYILAN;
  // 1 cent – $5 arası; panel yanlışlıkla $50 yazmasın.
  return Math.min(5, Math.max(0.01, Math.round(usd * 100) / 100));
}

/** Panel: 1 adet test hakkı ver (varsayılan 30 dk, tavan $0.05). */
export async function testIzniVer(
  dakika = 30,
  tavanUsd = TEST_TAVAN_USD_VARSAYILAN
): Promise<{ bitisMs: number; tavanUsd: number }> {
  const bitisMs = Date.now() + Math.max(5, dakika) * 60 * 1000;
  const tavan = tavanNormalize(tavanUsd);
  await yaz({ kalan: 1, bitisMs, tavanUsd: tavan, harcamaMikro: 0 });
  return { bitisMs, tavanUsd: tavan };
}

export async function testIzniDurum(): Promise<{
  varMi: boolean;
  kalan: number;
  bitisMs: number | null;
  dakikaKalan: number;
  tavanUsd: number | null;
  /** İzin tüketilmiş, tur devam ediyor (harcama sayılıyor). */
  aktifTur: boolean;
}> {
  const d = await oku();
  if (!d) {
    return {
      varMi: false,
      kalan: 0,
      bitisMs: null,
      dakikaKalan: 0,
      tavanUsd: null,
      aktifTur: false,
    };
  }
  if (Date.now() > d.bitisMs) {
    await yaz(null);
    return {
      varMi: false,
      kalan: 0,
      bitisMs: null,
      dakikaKalan: 0,
      tavanUsd: null,
      aktifTur: false,
    };
  }
  // Tüketilmiş aktif tur — silme (harcama/tavan burada).
  if (d.tuketildiMs && d.kalan < 1) {
    return {
      varMi: false,
      kalan: 0,
      bitisMs: d.bitisMs,
      dakikaKalan: Math.max(0, Math.ceil((d.bitisMs - Date.now()) / 60000)),
      tavanUsd: d.tavanUsd ?? TEST_TAVAN_USD_VARSAYILAN,
      aktifTur: true,
    };
  }
  if (d.kalan < 1) {
    await yaz(null);
    return {
      varMi: false,
      kalan: 0,
      bitisMs: null,
      dakikaKalan: 0,
      tavanUsd: null,
      aktifTur: false,
    };
  }
  return {
    varMi: true,
    kalan: d.kalan,
    bitisMs: d.bitisMs,
    dakikaKalan: Math.max(0, Math.ceil((d.bitisMs - Date.now()) / 60000)),
    tavanUsd: d.tavanUsd ?? TEST_TAVAN_USD_VARSAYILAN,
    aktifTur: false,
  };
}

/**
 * Atomik tüket: kalan 1→0. Başarısızsa false.
 * Test başında bir kez çağrılır; tavan + harcama sayacı korunur.
 */
export async function testIzniniTuket(): Promise<boolean> {
  const d = await oku();
  if (!d || d.kalan < 1 || Date.now() > d.bitisMs) {
    await yaz(null);
    return false;
  }
  await yaz({
    kalan: 0,
    bitisMs: d.bitisMs,
    tavanUsd: d.tavanUsd ?? TEST_TAVAN_USD_VARSAYILAN,
    harcamaMikro: 0,
    tuketildiMs: Date.now(),
  });
  return true;
}

/** Aktif test turu kaydı (tüketilmiş izin). */
async function aktifTurOku(): Promise<IzinKayit | null> {
  const d = await oku();
  if (!d?.tuketildiMs) return null;
  if (Date.now() > d.bitisMs) return null;
  return d;
}

export async function testTurTavanUsd(): Promise<number> {
  const d = await aktifTurOku();
  return d?.tavanUsd ?? TEST_TAVAN_USD_VARSAYILAN;
}

export async function testTurHarcamaMikro(): Promise<number> {
  const d = await aktifTurOku();
  return d?.harcamaMikro ?? 0;
}

/**
 * Çağrı öncesi: mevcut tur harcaması + tahmin tavanı aşarsa false.
 * tahminiEkMikro=0 → sadece birikmiş harcamaya bak (mesajlar arası).
 */
export async function testTurButceMusaitMi(
  tahminiEkMikro = 0
): Promise<boolean> {
  const d = await aktifTurOku();
  if (!d) return true;
  const tavanMikro = Math.round(
    (d.tavanUsd ?? TEST_TAVAN_USD_VARSAYILAN) * 1_000_000
  );
  const harcama = d.harcamaMikro ?? 0;
  return harcama + Math.max(0, tahminiEkMikro) < tavanMikro;
}

/** Başarılı (veya ücretli) çağrı sonrası tur harcamasına ekle. */
export async function testTurHarcamaEkle(mikro: number): Promise<void> {
  if (mikro <= 0) return;
  const d = await aktifTurOku();
  if (!d) return;
  await yaz({
    ...d,
    harcamaMikro: (d.harcamaMikro ?? 0) + mikro,
  });
}

/** Test bitince izni tamamen sil. */
export async function testIzniniSifirla(): Promise<void> {
  await yaz(null);
}
