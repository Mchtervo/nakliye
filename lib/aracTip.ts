/**
 * Araç sınıfı (çekici/kamyon…) ile kasa/dorse tipi (tenteli, frigo…) ayrı tutulur.
 * Kasa kodları ilan araç kodlarıyla (lib/arac ARAC_TIPLERI) aynıdır.
 * İstemci ve sunucuda kullanılır (veritabanı bağımlılığı yok).
 */
export const ARAC_SINIFLARI = [
  { kod: "TIR", ad: "Tır", alt: "Çekici + dorse" },
  { kod: "KAMYON", ad: "Kamyon", alt: "Tek şasi" },
  { kod: "KAMYONET", ad: "Kamyonet", alt: "Hafif ticari" },
  { kod: "PANELVAN", ad: "Panelvan", alt: "Kapalı van" },
  { kod: "DIGER", ad: "Diğer", alt: "Kırkayak, çekici…" },
] as const;

export type AracSinifi = (typeof ARAC_SINIFLARI)[number]["kod"];

export const KASA_TIPLERI = [
  { kod: "TENTELI", ad: "Tenteli" },
  { kod: "KAPALI_KASA", ad: "Kapalı kasa" },
  { kod: "FRIGO", ad: "Frigo" },
  { kod: "SAL_DORSE", ad: "Açık kasa" },
  { kod: "DAMPER", ad: "Damper" },
  { kod: "LOWBED", ad: "Lowbed" },
  { kod: "KONTEYNER", ad: "Konteyner" },
  { kod: "TANKER", ad: "Tanker" },
] as const;

export type KasaTipi = (typeof KASA_TIPLERI)[number]["kod"];

/** Araç sınıfına uygun gövde seçenekleri */
const UYGUN: Record<AracSinifi, KasaTipi[]> = {
  TIR: ["TENTELI", "KAPALI_KASA", "FRIGO", "SAL_DORSE", "DAMPER", "LOWBED", "KONTEYNER", "TANKER"],
  KAMYON: ["TENTELI", "KAPALI_KASA", "FRIGO", "SAL_DORSE", "DAMPER", "TANKER"],
  KAMYONET: ["SAL_DORSE", "KAPALI_KASA", "TENTELI", "FRIGO"],
  PANELVAN: ["KAPALI_KASA", "FRIGO"],
  DIGER: ["TENTELI", "KAPALI_KASA", "FRIGO", "SAL_DORSE", "DAMPER", "LOWBED", "KONTEYNER", "TANKER"],
};

export function uygunKasaTipleri(sinif: string | null | undefined) {
  const liste = UYGUN[(sinif as AracSinifi) || "DIGER"] ?? UYGUN.DIGER;
  return KASA_TIPLERI.filter((k) => liste.includes(k.kod));
}

export function sinifAdi(kod: string | null | undefined): string | null {
  return ARAC_SINIFLARI.find((s) => s.kod === kod)?.ad ?? null;
}

export function kasaAdi(kod: string | null | undefined): string | null {
  return KASA_TIPLERI.find((k) => k.kod === kod)?.ad ?? null;
}

/** "Tır · Tenteli" gibi kısa ad (eski kayıtlarda serbest ad kalır) */
export function aracEtiketi(a: { ad: string; sinif?: string | null; kasaTipi?: string | null }): string {
  const parca = [sinifAdi(a.sinif), kasaAdi(a.kasaTipi)].filter(Boolean);
  return parca.length ? parca.join(" · ") : a.ad;
}

export const PLAKA_DESENI = /^\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,5}$/;
