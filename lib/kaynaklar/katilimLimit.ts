/** Otomatik gruba katılım limitleri (cron-katil). */
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";

export const KATILIM_GUNLUK_LIMIT = 8;
export const KATILIM_ARA_MS = 30 * 60 * 1000;

/** Varsayılan min üye — Ayarlar’dan `telegram_katilim_min_uye` ile değişir.
 *  Arama API’si üye sayısını sık eksik verir; 15 tüm ADAY havuzunu kilitlemişti.
 *  Asıl kalite filtresi cron-katil içerik sinyali (%20). */
export const KATILIM_MIN_UYE_VARSAYILAN = 5;

/** 1–5000 arası; boş/geçersiz → varsayılan. */
export async function katilimMinUyeOku(): Promise<number> {
  const ham = await ayarOku(AYAR_ANAHTARLARI.telegramKatilimMinUye);
  if (ham === null || ham === "") return KATILIM_MIN_UYE_VARSAYILAN;
  const n = Number(String(ham).replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 1) return KATILIM_MIN_UYE_VARSAYILAN;
  return Math.min(5000, Math.round(n));
}
