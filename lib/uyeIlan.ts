import { prisma } from "@/lib/prisma";

/**
 * Üyenin ortak ilanlar üzerindeki kendi durumları (takip, iletişim, gizleme).
 * Üyenin şemasındaki Ayar'da tutulur; yöneticinin ilan durumlarına dokunmaz.
 */
const ANAHTAR = "uye_ilan_durum";
const UST_SINIR = 600;

export async function uyeIlanDurumlari(): Promise<Map<number, string>> {
  const a = await prisma.ayar.findUnique({ where: { anahtar: ANAHTAR } });
  try {
    const nesne = JSON.parse(a?.deger || "{}") as Record<string, string>;
    return new Map(Object.entries(nesne).map(([k, v]) => [Number(k), v]));
  } catch {
    return new Map();
  }
}

export async function uyeIlanDurumYaz(ilanId: number, durum: string): Promise<void> {
  const harita = await uyeIlanDurumlari();
  harita.delete(ilanId);
  if (durum !== "YENI") harita.set(ilanId, durum);
  // En yeniler kalsın (eklenme sırası korunur)
  const kayit = Object.fromEntries([...harita].slice(-UST_SINIR));
  const deger = JSON.stringify(kayit);
  await prisma.ayar.upsert({ where: { anahtar: ANAHTAR }, create: { anahtar: ANAHTAR, deger }, update: { deger } });
}
