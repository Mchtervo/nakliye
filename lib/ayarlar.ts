import { prisma } from "@/lib/prisma";
import { aracKodlariCozumle, type AracTipiKodu } from "@/lib/arac";
import {
  bolgeCozumle,
  VARSAYILAN_BOLGELER,
  type BolgeKodu,
} from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";

export const AYAR_ANAHTARLARI = {
  hizliAraTelefon: "hizli_ara_telefon",
  muhasebeciTelefon: "muhasebeci_telefon",
  aiSehir: "ai_sehir",
  aiRotalar: "ai_rotalar",
  aiMinUcret: "ai_min_ucret",
  aiBolgeler: "ai_bolgeler",
  // Aracım: ilanları süzmek için kullanılır
  aiAracTipleri: "ai_arac_tipleri",
  aiMaxTonaj: "ai_max_tonaj",
  aiAnaUs: "ai_ana_us",
  telegramChatId: "telegram_chat_id",
  bildirimTelegram: "bildirim_telegram",
  bildirimPush: "bildirim_push",
  // Telegram kullanıcı hesabıyla grup keşfi / okuma
  telegramUyeAktif: "telegram_uye_aktif",
  telegramSorguSira: "telegram_sorgu_sira",
  telegramKesifZaman: "telegram_kesif_zaman",
} as const;

export type AyarAnahtari =
  (typeof AYAR_ANAHTARLARI)[keyof typeof AYAR_ANAHTARLARI];

export async function ayarOku(anahtar: AyarAnahtari): Promise<string | null> {
  const kayit = await prisma.ayar.findUnique({ where: { anahtar } });
  return kayit?.deger ?? null;
}

export async function ayarlariOku(
  anahtarlar: AyarAnahtari[]
): Promise<Record<string, string>> {
  const kayitlar = await prisma.ayar.findMany({
    where: { anahtar: { in: anahtarlar } },
  });
  return Object.fromEntries(kayitlar.map((k) => [k.anahtar, k.deger]));
}

export async function ayarYaz(
  anahtar: AyarAnahtari,
  deger: string
): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar },
    create: { anahtar, deger },
    update: { deger },
  });
}

export async function ayarSil(anahtar: AyarAnahtari): Promise<void> {
  await prisma.ayar.delete({ where: { anahtar } }).catch(() => null);
}

export type AiTercihleri = {
  sehir: string | null;
  rotalar: string[];
  minUcret: number | null; // kuruş
  bolgeler: BolgeKodu[];
  aracTipleri: AracTipiKodu[];
  maxTonaj: number | null;
  anaUs: string | null;
  telegramChatId: string | null;
  telegramAcik: boolean;
  pushAcik: boolean;
  telegramUyeAcik: boolean;
};

export async function aiTercihleriOku(): Promise<AiTercihleri> {
  const a = await ayarlariOku([
    AYAR_ANAHTARLARI.aiSehir,
    AYAR_ANAHTARLARI.aiRotalar,
    AYAR_ANAHTARLARI.aiMinUcret,
    AYAR_ANAHTARLARI.aiBolgeler,
    AYAR_ANAHTARLARI.aiAracTipleri,
    AYAR_ANAHTARLARI.aiMaxTonaj,
    AYAR_ANAHTARLARI.aiAnaUs,
    AYAR_ANAHTARLARI.telegramChatId,
    AYAR_ANAHTARLARI.bildirimTelegram,
    AYAR_ANAHTARLARI.bildirimPush,
    AYAR_ANAHTARLARI.telegramUyeAktif,
  ]);

  const minHam = Number(a[AYAR_ANAHTARLARI.aiMinUcret]);
  const bolgeHam = a[AYAR_ANAHTARLARI.aiBolgeler];
  const tonajHam = Number(a[AYAR_ANAHTARLARI.aiMaxTonaj]);

  return {
    sehir: a[AYAR_ANAHTARLARI.aiSehir] || null,
    rotalar: (a[AYAR_ANAHTARLARI.aiRotalar] || "")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean),
    minUcret: Number.isFinite(minHam) && minHam > 0 ? minHam : null,
    bolgeler:
      bolgeHam === undefined ? VARSAYILAN_BOLGELER : bolgeCozumle(bolgeHam),
    aracTipleri: aracKodlariCozumle(a[AYAR_ANAHTARLARI.aiAracTipleri]),
    maxTonaj:
      Number.isFinite(tonajHam) && tonajHam > 0 ? Math.round(tonajHam) : null,
    anaUs: ilBul(a[AYAR_ANAHTARLARI.aiAnaUs]),
    telegramChatId: a[AYAR_ANAHTARLARI.telegramChatId] || null,
    // Varsayılan açık: kullanıcı kapatmadıkça bildirim gitsin.
    telegramAcik: a[AYAR_ANAHTARLARI.bildirimTelegram] !== "0",
    pushAcik: a[AYAR_ANAHTARLARI.bildirimPush] !== "0",
    telegramUyeAcik: a[AYAR_ANAHTARLARI.telegramUyeAktif] !== "0",
  };
}
