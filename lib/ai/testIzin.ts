import { prisma } from "@/lib/prisma";

/** Tek kullanımlık test izni — AI_KAPALI iken bile 1 test için. */
export const TEST_IZIN_ANAHTAR = "ai_test_izin";

type IzinKayit = {
  kalan: number;
  bitisMs: number;
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

/** Panel: 1 adet test hakkı ver (varsayılan 30 dk). */
export async function testIzniVer(dakika = 30): Promise<{
  bitisMs: number;
}> {
  const bitisMs = Date.now() + Math.max(5, dakika) * 60 * 1000;
  await yaz({ kalan: 1, bitisMs });
  return { bitisMs };
}

export async function testIzniDurum(): Promise<{
  varMi: boolean;
  kalan: number;
  bitisMs: number | null;
  dakikaKalan: number;
}> {
  const d = await oku();
  if (!d || d.kalan < 1 || Date.now() > d.bitisMs) {
    if (d) await yaz(null);
    return { varMi: false, kalan: 0, bitisMs: null, dakikaKalan: 0 };
  }
  return {
    varMi: true,
    kalan: d.kalan,
    bitisMs: d.bitisMs,
    dakikaKalan: Math.max(0, Math.ceil((d.bitisMs - Date.now()) / 60000)),
  };
}

/**
 * Atomik tüket: kalan 1→0. Başarısızsa false.
 * Test başında bir kez çağrılır; bitince sifirla.
 */
export async function testIzniniTuket(): Promise<boolean> {
  const d = await oku();
  if (!d || d.kalan < 1 || Date.now() > d.bitisMs) {
    await yaz(null);
    return false;
  }
  await yaz({ kalan: 0, bitisMs: d.bitisMs, tuketildiMs: Date.now() });
  return true;
}

/** Test bitince izni tamamen sil. */
export async function testIzniniSifirla(): Promise<void> {
  await yaz(null);
}
