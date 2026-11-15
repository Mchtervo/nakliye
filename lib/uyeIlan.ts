import { aktifBaglam } from "@/lib/baglam";
import { prisma } from "@/lib/prisma";

/**
 * Üyenin ortak ilanlar üzerindeki kendi durumları (takip, iletişim, gizleme).
 * Üyenin şemasındaki Ayar'da tutulur; yöneticinin ilan durumlarına dokunmaz.
 */
const ANAHTAR = "uye_ilan_durum";

/**
 * Üye "Yük bul" bölümünü kapattı mı (Kişisel ayarlar → Yükler). Varsayılan açık.
 * Yalnız üye bağlamında çağrılır (kendi şemasındaki Ayar).
 */
const yuklerBellek = new Map<number, { acik: boolean; an: number }>();

/** Ayar değişince (Kişisel ayarlar) çağrılır: menü hemen güncellensin. */
export function yuklerAcikBellekSil(uyeId: number): void {
  yuklerBellek.delete(uyeId);
}

export async function yuklerAcikMi(): Promise<boolean> {
  // Menü için her sayfada sorulur: 1 dk bellekte tutulur (sorgu başına ~0,25 sn)
  const uyeId = (await aktifBaglam()).uyeId;
  const b = uyeId !== null ? yuklerBellek.get(uyeId) : undefined;
  if (b && Date.now() - b.an < 60_000) return b.acik;
  const a = await prisma.ayar.findUnique({ where: { anahtar: "uye_yukler_acik" } }).catch(() => null);
  const acik = a?.deger !== "0";
  if (uyeId !== null) yuklerBellek.set(uyeId, { acik, an: Date.now() });
  return acik;
}
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
