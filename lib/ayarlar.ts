import { prisma } from "@/lib/prisma";
import { aracKodlariCozumle, type AracTipiKodu } from "@/lib/arac";
import {
  bolgeCozumle,
  kesifKelimeleriCozumle,
  VARSAYILAN_BOLGELER,
  VARSAYILAN_KESIF_KORIDOR_KELIMELER,
  type BolgeKodu,
} from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import {
  koridorIlleriCozumle,
  VARSAYILAN_KORIDOR_ILLER,
} from "@/lib/koridor";
import { VARSAYILAN_MALIYET } from "@/lib/karHesap";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";

/** Sayaç kuralları için minimum birikim (gün). */
export const SAYAC_MIN_VERI_GUN = 5;

/**
 * Sayaç başlangıç tarihi. Yoksa bugünü yazar (bir kerelik sıfırlama).
 * Dönüş: YYYY-MM-DD (TR günü).
 */
export async function sayacBaslangicGaranti(): Promise<string> {
  const mevcut = await ayarOku(AYAR_ANAHTARLARI.sayacBaslangic);
  if (mevcut && /^\d{4}-\d{2}-\d{2}$/.test(mevcut.trim())) {
    return mevcut.trim();
  }
  const bugun = bugunAnahtar();
  await ayarYaz(AYAR_ANAHTARLARI.sayacBaslangic, bugun);
  return bugun;
}

/** YYYY-MM-DD → Date (TR günü başlangıcı, UTC+3 geceyarısı ≈ UTC-3 prev day 21:00 — basit: T00:00Z yeter). */
export function sayacBaslangicDate(isoGun: string): Date {
  return new Date(`${isoGun.trim()}T00:00:00+03:00`);
}

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
  /** Otomatik katılım min üye (varsayılan 15) */
  telegramKatilimMinUye: "telegram_katilim_min_uye",
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
  /** Günlük Bilgi Sor (Telegram DM) üst sınırı (varsayılan 10) */
  tdmGunlukLimit: "tdm_gunluk_limit",
  /** @deprecated otomatik DM kaldırıldı */
  tdmOtomatik: "tdm_otomatik",
  /** Mesaj metin şablonu: {rota} */
  waMesajSablon: "wa_mesaj_sablon",
  /** 1 = VPS auto-deploy (git poll) açık */
  autoDeploy: "auto_deploy",
  /** Kâr hesabı: lt / 100 km */
  maliyetYakitLt100: "maliyet_yakit_lt100",
  /** Motorin ₺ / litre */
  maliyetMotorinTl: "maliyet_motorin_tl",
  /** Km başı sabit gider ₺ */
  maliyetSabitTlKm: "maliyet_sabit_tl_km",
  /** Km başı HGS tahmini ₺ */
  maliyetHgsTlKm: "maliyet_hgs_tl_km",
  /** İstiap haddi (ton) — maliyet profili */
  maliyetTonaj: "maliyet_tonaj",
  /** Budama: kaç gün 0 mesaj → çıkış adayı */
  budamaSessizGun: "budama_sessiz_gun",
  /** Budama: mesaj var ama 0 ilan (gün) */
  budamaSifirIlanGun: "budama_sifir_ilan_gun",
  /** Budama: düşük isabet penceresi (gün) */
  budamaIsabetGun: "budama_isabet_gun",
  /** Budama: yeni gruba koruma (gün) */
  budamaKorumaGun: "budama_koruma_gun",
  /**
   * Budama/isabet sayaç başlangıcı (YYYY-MM-DD, TR).
   * Boru hattı bozukken biriken 0-ilan verisi yok sayılsın.
   */
  sayacBaslangic: "sayac_baslangic",
  /**
   * Keşif koridor kelime havuzu (satır veya virgül).
   * Boş = varsayılan Ankara–İstanbul hattı listesi. Havuzun ~%70’i.
   */
  kesifKoridorKelimeler: "kesif_koridor_kelimeler",
} as const;

export type AyarAnahtari =
  (typeof AYAR_ANAHTARLARI)[keyof typeof AYAR_ANAHTARLARI];

/**
 * VPS .env kilidi: AUTO_DEPLOY=1|true|yes|on → panel/DB ne olursa olsun açık.
 * Kısır döngüyü kırar (panel hatası auto_deploy'u 0 yapınca deploy kilitlenmesin).
 */
export function autoDeployEnvAcikMi(): boolean {
  const v = (process.env.AUTO_DEPLOY || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

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
  maxTonaj: number;
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
    mesajSablon: string;
  };
  tdmKaraListe: string;
  tdmGunlukLimit: number;
  /** Otomatik gruba katılım min üye sayısı */
  katilimMinUye: number;
  /** VPS: push sonrası otomatik deploy */
  autoDeploy: boolean;
  /** Kâr hesabı parametreleri */
  maliyet: {
    yakitLt100: number;
    motorinTl: number;
    sabitTlKm: number;
    hgsTlKm: number;
    /** İstiap haddi (ton) */
    tonaj: number;
  };
  /** Grup budama eşikleri (gün) */
  budama: {
    sessizGun: number;
    sifirIlanGun: number;
    isabetGun: number;
    korumaGun: number;
  };
  /**
   * Sayaç sıfırlama tarihi (YYYY-MM-DD).
   * Budama sayaç kuralları bu tarihten +5 gün sonra devreye girer.
   */
  sayacBaslangic: string;
  /**
   * Keşif koridor kelimeleri (Ayarlar). Boş ayar → varsayılan liste.
   * Formda her zaman dolu gösterilir (varsayılanla).
   */
  kesifKoridorKelimeler: string[];
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
    AYAR_ANAHTARLARI.waMesajSablon,
    AYAR_ANAHTARLARI.autoDeploy,
    AYAR_ANAHTARLARI.maliyetYakitLt100,
    AYAR_ANAHTARLARI.maliyetMotorinTl,
    AYAR_ANAHTARLARI.maliyetSabitTlKm,
    AYAR_ANAHTARLARI.maliyetHgsTlKm,
    AYAR_ANAHTARLARI.maliyetTonaj,
    AYAR_ANAHTARLARI.budamaSessizGun,
    AYAR_ANAHTARLARI.budamaSifirIlanGun,
    AYAR_ANAHTARLARI.budamaIsabetGun,
    AYAR_ANAHTARLARI.budamaKorumaGun,
    AYAR_ANAHTARLARI.sayacBaslangic,
    AYAR_ANAHTARLARI.kesifKoridorKelimeler,
  ]);

  const minHam = Number(a[AYAR_ANAHTARLARI.aiMinUcret]);
  const bolgeHam = a[AYAR_ANAHTARLARI.aiBolgeler];
  const tonajHam = Number(a[AYAR_ANAHTARLARI.aiMaxTonaj]);
  const maliyetTonajHam = Number(a[AYAR_ANAHTARLARI.maliyetTonaj]);
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

  function sayiOku(ham: string | undefined, varsayilan: number): number {
    if (ham === undefined || ham === "") return varsayilan;
    const n = Number(String(ham).replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : varsayilan;
  }

  const maliyetTonaj = sayiOku(
    a[AYAR_ANAHTARLARI.maliyetTonaj],
    VARSAYILAN_MALIYET.tonaj
  );
  // Max tonaj: ayrı ayar varsa onu kullan; yoksa istiap (maliyet.tonaj)
  const maxTonajCozulmus =
    Number.isFinite(tonajHam) && tonajHam > 0
      ? Math.round(tonajHam)
      : Number.isFinite(maliyetTonajHam) && maliyetTonajHam > 0
        ? Math.round(maliyetTonajHam)
        : maliyetTonaj;

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
    maxTonaj: maxTonajCozulmus,
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
      mesajSablon: a[AYAR_ANAHTARLARI.waMesajSablon] || "",
    },
    tdmKaraListe: a[AYAR_ANAHTARLARI.tdmKaraListe] || "",
    tdmGunlukLimit: (() => {
      const n = Number(a[AYAR_ANAHTARLARI.tdmGunlukLimit]);
      if (!Number.isFinite(n) || n < 1) return 10;
      return Math.min(30, Math.round(n));
    })(),
    katilimMinUye: (() => {
      const n = Number(a[AYAR_ANAHTARLARI.telegramKatilimMinUye]);
      if (!Number.isFinite(n) || n < 1) return 15;
      return Math.min(5000, Math.round(n));
    })(),
    autoDeploy:
      autoDeployEnvAcikMi() || a[AYAR_ANAHTARLARI.autoDeploy] === "1",
    maliyet: {
      yakitLt100: sayiOku(
        a[AYAR_ANAHTARLARI.maliyetYakitLt100],
        VARSAYILAN_MALIYET.yakitLt100
      ),
      motorinTl: sayiOku(
        a[AYAR_ANAHTARLARI.maliyetMotorinTl],
        VARSAYILAN_MALIYET.motorinTl
      ),
      sabitTlKm: sayiOku(
        a[AYAR_ANAHTARLARI.maliyetSabitTlKm],
        VARSAYILAN_MALIYET.sabitTlKm
      ),
      hgsTlKm: sayiOku(
        a[AYAR_ANAHTARLARI.maliyetHgsTlKm],
        VARSAYILAN_MALIYET.hgsTlKm
      ),
      tonaj: maliyetTonaj,
    },
    budama: {
      sessizGun: Math.max(
        1,
        Math.round(sayiOku(a[AYAR_ANAHTARLARI.budamaSessizGun], 4))
      ),
      sifirIlanGun: Math.max(
        1,
        Math.round(sayiOku(a[AYAR_ANAHTARLARI.budamaSifirIlanGun], 5))
      ),
      isabetGun: Math.max(
        1,
        Math.round(sayiOku(a[AYAR_ANAHTARLARI.budamaIsabetGun], 7))
      ),
      korumaGun: Math.max(
        1,
        Math.round(sayiOku(a[AYAR_ANAHTARLARI.budamaKorumaGun], 4))
      ),
    },
    sayacBaslangic: (() => {
      const ham = (a[AYAR_ANAHTARLARI.sayacBaslangic] || "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(ham)) return ham;
      return bugunAnahtar();
    })(),
    kesifKoridorKelimeler: (() => {
      const ozel = kesifKelimeleriCozumle(
        a[AYAR_ANAHTARLARI.kesifKoridorKelimeler]
      );
      return ozel.length > 0
        ? ozel
        : [...VARSAYILAN_KESIF_KORIDOR_KELIMELER];
    })(),
  };
}
