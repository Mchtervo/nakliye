import { prisma } from "@/lib/prisma";
import { gunlukButceUsd, mikrodolarYaz } from "@/lib/ai/maliyet";
import { telegramGonder, telegramKullanilabilir } from "@/lib/bildirim/telegram";
import { aiTercihleriOku } from "@/lib/ayarlar";

/** Runtime bütçe kesmesi — env AI_KAPALI'dan bağımsız, DB'de tutulur. */
export const BUTCE_KESIM_ANAHTAR = "ai_butce_kesildi";
/** Günde bir hatırlatma için TR gün anahtarı (YYYY-MM-DD). */
export const BUTCE_HATIRLAT_ANAHTAR = "ai_butce_hatirlat_gun";

async function bayrakOku(): Promise<string | null> {
  const k = await prisma.ayar.findUnique({
    where: { anahtar: BUTCE_KESIM_ANAHTAR },
  });
  return k?.deger ?? null;
}

async function bayrakYaz(deger: string): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar: BUTCE_KESIM_ANAHTAR },
    create: { anahtar: BUTCE_KESIM_ANAHTAR, deger },
    update: { deger },
  });
}

/** TR gününün başlangıcı (00:00 Europe/Istanbul). */
export function trGunBaslangici(tarih = new Date()): Date {
  const tr = new Date(tarih.getTime() + 3 * 60 * 60 * 1000);
  const ymd = tr.toISOString().slice(0, 10);
  return new Date(`${ymd}T00:00:00+03:00`);
}

/** TR günü YYYY-MM-DD. */
export function trGunAnahtari(tarih = new Date()): string {
  const tr = new Date(tarih.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 10);
}

export async function bugunHarcamaMikro(): Promise<number> {
  const bas = trGunBaslangici();
  const sonuc = await prisma.aiCagri.aggregate({
    where: { zaman: { gte: bas } },
    _sum: { maliyetMikro: true },
  });
  return sonuc._sum.maliyetMikro ?? 0;
}

/**
 * Bayrak indirilmiş olsa bile: bugünkü harcama mevcut limitin altındaysa
 * otomatik aç (yeni TR günü veya limit yükseltildi).
 */
export async function butceBayraginiSenkronizeEt(): Promise<boolean> {
  if ((await bayrakOku()) !== "1") return false;

  const harcama = await bugunHarcamaMikro();
  const limitMikro = Math.round(gunlukButceUsd() * 1_000_000);
  if (harcama < limitMikro) {
    await bayrakYaz("0");
    return false;
  }
  return true;
}

export async function butceKesildiMi(): Promise<boolean> {
  return butceBayraginiSenkronizeEt();
}

/**
 * Bütçe aşıldıysa DB bayrağını indir, Telegram'a yaz.
 * Env AI_KAPALI'yı Netlify'da runtime değiştiremeyiz; DB bayrak şart.
 */
export async function butceyiKes(harcamaMikro: number): Promise<void> {
  const onceki = (await bayrakOku()) === "1";
  await bayrakYaz("1");
  if (onceki) return;

  const limit = gunlukButceUsd();
  const metin =
    `⛔ <b>AI bütçe kesildi</b>\n` +
    `Günlük limit: $${limit.toFixed(2)}\n` +
    `Harcama: ${mikrodolarYaz(harcamaMikro)}\n` +
    `Limit yükseltilince veya yarın (TR 00:00) otomatik açılır.`;

  console.error("[butce]", `limit=$${limit} harcama=${mikrodolarYaz(harcamaMikro)}`);

  if (!telegramKullanilabilir()) return;
  const tercih = await aiTercihleriOku();
  if (tercih.telegramChatId) {
    await telegramGonder(tercih.telegramChatId, metin);
  }
}

/**
 * Limit kontrolü. tahminiEkMikro > 0 ise çağrı başlamadan önce
 * (harcama + tahmin) ≥ limit ise kes — faturalanmadan dur.
 */
export async function butceMusaitMi(tahminiEkMikro = 0): Promise<boolean> {
  if (await butceKesildiMi()) return false;

  const harcama = await bugunHarcamaMikro();
  const limitMikro = Math.round(gunlukButceUsd() * 1_000_000);
  const proje = harcama + Math.max(0, tahminiEkMikro);
  if (proje >= limitMikro) {
    await butceyiKes(harcama);
    return false;
  }
  return true;
}

/** Elle bütçe kesmesini kaldır. */
export async function butceKesiminiAc(): Promise<void> {
  await bayrakYaz("0");
}

/**
 * Bütçe kesikken günde bir hatırlatma (log + Telegram).
 * Aynı TR gününde tekrar çağrılırsa sessiz.
 */
export async function butceKesikHatirlat(kalanMesaj: number): Promise<boolean> {
  const gun = trGunAnahtari();
  const onceki = await prisma.ayar.findUnique({
    where: { anahtar: BUTCE_HATIRLAT_ANAHTAR },
  });
  if (onceki?.deger === gun) return false;

  await prisma.ayar.upsert({
    where: { anahtar: BUTCE_HATIRLAT_ANAHTAR },
    create: { anahtar: BUTCE_HATIRLAT_ANAHTAR, deger: gun },
    update: { deger: gun },
  });

  const limit = gunlukButceUsd();
  const harcama = await bugunHarcamaMikro();
  const metin =
    `⏸ <b>AI bütçe kesik</b>\n` +
    `Limit: $${limit.toFixed(2)} · Harcama: ${mikrodolarYaz(harcama)}\n` +
    `${kalanMesaj} mesaj bekliyor. Cron sessiz atlıyor.`;

  console.log(
    `[cron-ai-kuyruk] bütçe kesik, ${kalanMesaj} mesaj bekliyor (günde 1 hatırlatma)`
  );

  if (telegramKullanilabilir()) {
    const tercih = await aiTercihleriOku();
    if (tercih.telegramChatId) {
      await telegramGonder(tercih.telegramChatId, metin);
    }
  }
  return true;
}
