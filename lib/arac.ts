import { sadelestir } from "@/lib/iller";

export const ARAC_TIPLERI = [
  { kod: "TENTELI", ad: "Tenteli" },
  { kod: "FRIGO", ad: "Frigo" },
  { kod: "DAMPER", ad: "Damper" },
  { kod: "KAPALI_KASA", ad: "Kapalı kasa" },
  { kod: "LOWBED", ad: "Lowbed" },
  { kod: "SAL_DORSE", ad: "Sal / açık dorse" },
  { kod: "KAMYON", ad: "Kamyon / kamyonet" },
  { kod: "DIGER", ad: "Diğer" },
] as const;

export type AracTipiKodu = (typeof ARAC_TIPLERI)[number]["kod"];

const KOD_ADLARI = new Map<string, string>(
  ARAC_TIPLERI.map((a) => [a.kod, a.ad])
);

export function aracTipiAdi(kod: string | null): string | null {
  return kod ? (KOD_ADLARI.get(kod) ?? null) : null;
}

/**
 * İlanlarda araç tipi serbest metin: "Tenteli Frigo tır", "13.60 sal dorse",
 * "sınırsız damper"... Filtre kurabilmek için sabit koda indirgenir.
 * "Tır" tek başına kasa tipi söylemez, kod üretmez.
 */
const ANAHTARLAR: { kod: AracTipiKodu; kelimeler: string[] }[] = [
  { kod: "FRIGO", kelimeler: ["frigo", "frigorifik", "sogutuculu", "termo"] },
  { kod: "TENTELI", kelimeler: ["tenteli", "tente", "perdeli", "brandali"] },
  { kod: "DAMPER", kelimeler: ["damper", "damperli", "kaya tipi"] },
  {
    kod: "KAPALI_KASA",
    kelimeler: ["kapali kasa", "kapali", "panelvan", "panel van", "box"],
  },
  { kod: "LOWBED", kelimeler: ["lowbed", "low bed", "lowbet", "havuzlu"] },
  {
    kod: "SAL_DORSE",
    kelimeler: ["sal dorse", "sal", "acik dorse", "platform", "flatbed"],
  },
  {
    kod: "KAMYON",
    kelimeler: ["kamyonet", "kamyon", "kirkayak", "10 teker", "6 teker"],
  },
];

/** Serbest metinden araç tipi kodunu çıkarır; anlaşılmazsa null. */
export function aracKoduBul(metin: string | null | undefined): AracTipiKodu | null {
  if (!metin) return null;
  const sade = sadelestir(metin);
  if (!sade) return null;

  // Metinde ilk geçen tip belirleyicidir: "tenteli frigo" -> tenteli.
  let enIyi: { kod: AracTipiKodu; yer: number } | null = null;
  for (const { kod, kelimeler } of ANAHTARLAR) {
    for (const kelime of kelimeler) {
      const yer = sade.indexOf(kelime);
      if (yer < 0) continue;
      if (!enIyi || yer < enIyi.yer) enIyi = { kod, yer };
    }
  }
  return enIyi?.kod ?? null;
}

/** Ayarlardaki çoklu seçimi güvenli koda çevirir. */
export function aracKodlariCozumle(ham: string | null | undefined): AracTipiKodu[] {
  if (!ham) return [];
  const gecerli = new Set(ARAC_TIPLERI.map((a) => a.kod as string));
  const kodlar = ham
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter((p): p is AracTipiKodu => gecerli.has(p));
  return [...new Set(kodlar)];
}
