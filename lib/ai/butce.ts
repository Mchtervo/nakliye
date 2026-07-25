import { prisma } from "@/lib/prisma";
import { gunlukButceUsd, mikrodolarYaz } from "@/lib/ai/maliyet";
import { telegramGonder, telegramKullanilabilir } from "@/lib/bildirim/telegram";
import { aiTercihleriOku } from "@/lib/ayarlar";

/** Runtime bütçe kesmesi — env AI_KAPALI'dan bağımsız, DB'de tutulur. */
export const BUTCE_KESIM_ANAHTAR = "ai_butce_kesildi";

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

export async function bugunHarcamaMikro(): Promise<number> {
  const bas = trGunBaslangici();
  const sonuc = await prisma.aiCagri.aggregate({
    where: { zaman: { gte: bas } },
    _sum: { maliyetMikro: true },
  });
  return sonuc._sum.maliyetMikro ?? 0;
}

export async function butceKesildiMi(): Promise<boolean> {
  return (await bayrakOku()) === "1";
}

/**
 * Bütçe aşıldıysa DB bayrağını indir, Telegram'a yaz.
 * Env AI_KAPALI'yı Netlify'da runtime değiştiremeyiz; DB bayrak şart.
 */
export async function butceyiKes(harcamaMikro: number): Promise<void> {
  const onceki = await butceKesildiMi();
  await bayrakYaz("1");
  if (onceki) return;

  const limit = gunlukButceUsd();
  const metin =
    `⛔ <b>AI bütçe kesildi</b>\n` +
    `Günlük limit: $${limit.toFixed(2)}\n` +
    `Harcama: ${mikrodolarYaz(harcamaMikro)}\n` +
    `Otomatik kesme aktif. Ayarlar'dan açana kadar OpenAI çağrısı yok.`;

  console.error("[butce]", `limit=$${limit} harcama=${mikrodolarYaz(harcamaMikro)}`);

  if (!telegramKullanilabilir()) return;
  const tercih = await aiTercihleriOku();
  if (tercih.telegramChatId) {
    await telegramGonder(tercih.telegramChatId, metin);
  }
}

/** Çağrı öncesi: limit aşıldıysa kes ve false dön. */
export async function butceMusaitMi(): Promise<boolean> {
  if (await butceKesildiMi()) return false;

  const harcama = await bugunHarcamaMikro();
  const limitMikro = Math.round(gunlukButceUsd() * 1_000_000);
  if (harcama >= limitMikro) {
    await butceyiKes(harcama);
    return false;
  }
  return true;
}

/** Elle bütçe kesmesini kaldır. */
export async function butceKesiminiAc(): Promise<void> {
  await bayrakYaz("0");
}
