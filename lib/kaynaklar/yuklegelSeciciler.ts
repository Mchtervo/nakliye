/**
 * yuklegel.com CSS / URL seçicileri — DOM değişince SADECE burayı güncelle.
 * Ödeme duvarı / login denemesi YOK; yalnızca ücretsiz/açık içerik.
 */
export const YUKLEGEL_SECICILER = {
  /** Ana liste (ücretsiz gecikmeli ilanlar burada) */
  listUrls: ["https://yuklegel.com/"] as const,

  /** Sayfa linki adayları (pagination / detay) — HTML içinde aranır */
  sayfaLinkRegex:
    /https?:\/\/(?:www\.)?yuklegel\.com\/(?:[^\s"'<>]+)?/gi,

  /** Bunları takip etme (ödeme / auth) */
  engelliYol: [
    "/login",
    "/giris",
    "/uye",
    "/premium",
    "/odeme",
    "/payment",
    "/subscribe",
    "/abonnement",
  ] as const,

  /** Kart / ilan bloğu (HTML) — birden fazla aday */
  kartCss: [
    "[class*='ilan']",
    "[class*='listing']",
    "[class*='cargo']",
    "[class*='load']",
    "article",
    ".card",
  ] as const,

  /** Metin içinde paywall — bu blokları atla, login deneme */
  paywallKalip: [
    /giriş yapmanız gerekiyor/i,
    /telefon numaranız ile giriş/i,
    /son 15 dakika.*giriş/i,
    /üyelik.*gerek/i,
    /premium.*üyelik/i,
  ] as const,

  /** Zaman ayırıcı (ücretsiz listede sık) */
  zamanAyirici: /(\d+)\s*(dakika|saat|gün)\s*önce/gi,

  /** TR cep telefonu */
  telefonRegex:
    /(?:\+90|0)?\s*5\d{2}[\s.\-]*\d{3}[\s.\-]*\d{2}[\s.\-]*\d{2}/g,

  /** Tek tur limitleri */
  maxSayfa: 20,
  istekArasiMs: 3000,

  /** Kayıt: düşük öncelik / skor (firma havuzu amaçlı) */
  guvenSkoru: 42,
} as const;

export type YuklegelHamKart = {
  metin: string;
  telefon: string | null;
  kaynakUrl: string;
};
