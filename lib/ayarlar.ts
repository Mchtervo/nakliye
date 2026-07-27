import { prisma } from "@/lib/prisma";
import { aracKodlariCozumle, type AracTipiKodu } from "@/lib/arac";
import {
  bolgeCozumle,
  VARSAYILAN_BOLGELER,
  type BolgeKodu,
} from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import {
  koridorIlleriCozumle,
  VARSAYILAN_KORIDOR_ILLER,
} from "@/lib/koridor";

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
  /** Bölgeye ek il (virgüllü) — kod değiştirmeden genişletme */
  aiEkIller: "ai_ek_iller",
  /**
   * Çalışılan koridor illeri (virgüllü). Prompt + sunucu filtresi AYNI.
   * HEM çıkış HEM varış bu listede olmalı. Boş = varsayılan 8 il.
   */
  aiKoridorIller: "ai_koridor_iller",
  telegramChatId: "telegram_chat_id",
  bildirimTelegram: "bildirim_telegram",
  bildirimPush: "bildirim_push",
  // Telegram kullanıcı hesabıyla grup keşfi / okuma
  telegramUyeAktif: "telegram_uye_aktif",
  telegramSorguSira: "telegram_sorgu_sira",
  telegramKesifZaman: "telegram_kesif_zaman",
  /** Otomatik gruba katıl (1/0). Varsayılan açık. */
  telegramOtoKatilim: "telegram_oto_katilim",
  /** TR günü sayaç: YYYY-MM-DD:adet */
  telegramKatilimGunluk: "telegram_katilim_gunluk",
  telegramSonKatilim: "telegram_son_katilim",
  /** FloodWait bitiş ISO — dolana kadar katılım yok */
  telegramFloodBitis: "telegram_flood_bitis",
  /** WhatsApp mesaj şablonu */
  waSablonAd: "wa_sablon_ad",
  waSablonFirma: "wa_sablon_firma",
  waSablonArac: "wa_sablon_arac",
  waSablonTonaj: "wa_sablon_tonaj",
  waSablonMusaitlik: "wa_sablon_musaitlik",
  waSablonTonTercih: "wa_sablon_ton_tercih",
  waSablonImza: "wa_sablon_imza",
  /** DM kara liste — telefon / user id, virgüllü */
  tdmKaraListe: "tdm_kara_liste",
  /** Günlük onaylı DM üst sınırı (varsayılan 5) */
  tdmGunlukLimit: "tdm_gunluk_limit",
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
  /** Bölge checkbox'larına ek, elle yazılan iller (eski; koridora eklenir) */
  ekIller: string[];
  /**
   * Çalışılan koridor. Prompt + kayıt filtresi.
   * İki uç da bu listede olmalı.
   */
  koridorIller: string[];
  telegramChatId: string | null;
  telegramAcik: boolean;
  pushAcik: boolean;
  telegramUyeAcik: boolean;
  waSablon: {
    ad: string;
    firma: string;
    arac: string;
    tonaj: string;
    musaitlik: string;
    tonTercih: string;
    imza: string;
  };
  tdmKaraListe: string;
  tdmGunlukLimit: number;
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
    AYAR_ANAHTARLARI.aiEkIller,
    AYAR_ANAHTARLARI.aiKoridorIller,
    AYAR_ANAHTARLARI.telegramChatId,
    AYAR_ANAHTARLARI.bildirimTelegram,
    AYAR_ANAHTARLARI.bildirimPush,
    AYAR_ANAHTARLARI.telegramUyeAktif,
    AYAR_ANAHTARLARI.waSablonAd,
    AYAR_ANAHTARLARI.waSablonFirma,
    AYAR_ANAHTARLARI.waSablonArac,
    AYAR_ANAHTARLARI.waSablonTonaj,
    AYAR_ANAHTARLARI.waSablonMusaitlik,
    AYAR_ANAHTARLARI.waSablonTonTercih,
    AYAR_ANAHTARLARI.waSablonImza,
    AYAR_ANAHTARLARI.tdmKaraListe,
    AYAR_ANAHTARLARI.tdmGunlukLimit,
  ]);

  const minHam = Number(a[AYAR_ANAHTARLARI.aiMinUcret]);
  const bolgeHam = a[AYAR_ANAHTARLARI.aiBolgeler];
  const tonajHam = Number(a[AYAR_ANAHTARLARI.aiMaxTonaj]);
  const ekIller = (a[AYAR_ANAHTARLARI.aiEkIller] || "")
    .split(/[,\n]/)
    .map((p) => ilBul(p.trim()))
    .filter((il): il is string => Boolean(il));

  // Koridor ayarı yoksa varsayılan 8 il. Varsa aynen (ek iller birleştirilir).
  const koridorHam = a[AYAR_ANAHTARLARI.aiKoridorIller];
  let koridorIller =
    koridorHam === undefined
      ? [...VARSAYILAN_KORIDOR_ILLER]
      : koridorIlleriCozumle(koridorHam);
  for (const il of ekIller) {
    if (!koridorIller.includes(il)) koridorIller.push(il);
  }

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
    ekIller: [...new Set(ekIller)],
    koridorIller,
    telegramChatId: a[AYAR_ANAHTARLARI.telegramChatId] || null,
    // Varsayılan açık: kullanıcı kapatmadıkça bildirim gitsin.
    telegramAcik: a[AYAR_ANAHTARLARI.bildirimTelegram] !== "0",
    pushAcik: a[AYAR_ANAHTARLARI.bildirimPush] !== "0",
    telegramUyeAcik: a[AYAR_ANAHTARLARI.telegramUyeAktif] !== "0",
    waSablon: {
      ad: a[AYAR_ANAHTARLARI.waSablonAd] || "",
      firma: a[AYAR_ANAHTARLARI.waSablonFirma] || "",
      arac: a[AYAR_ANAHTARLARI.waSablonArac] || "",
      tonaj: a[AYAR_ANAHTARLARI.waSablonTonaj] || "",
      musaitlik: a[AYAR_ANAHTARLARI.waSablonMusaitlik] || "",
      tonTercih: a[AYAR_ANAHTARLARI.waSablonTonTercih] || "",
      imza: a[AYAR_ANAHTARLARI.waSablonImza] || "",
    },
    tdmKaraListe: a[AYAR_ANAHTARLARI.tdmKaraListe] || "",
    tdmGunlukLimit: (() => {
      const n = Number(a[AYAR_ANAHTARLARI.tdmGunlukLimit]);
      if (!Number.isFinite(n) || n < 1) return 5;
      return Math.min(30, Math.round(n));
    })(),
  };
}
