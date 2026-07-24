export const GIDER_KATEGORILERI = [
  { kod: "YAKIT", ad: "Yakıt" },
  { kod: "BAKIM", ad: "Bakım / Onarım" },
  { kod: "LASTIK", ad: "Lastik" },
  { kod: "OTOYOL", ad: "Otoyol / Köprü" },
  { kod: "SIGORTA", ad: "Sigorta / Kasko" },
  { kod: "VERGI", ad: "Vergi / Harç" },
  { kod: "YEMEK", ad: "Yemek / Konaklama" },
  { kod: "DIGER", ad: "Diğer" },
] as const;

export function kategoriAdi(kod: string): string {
  return GIDER_KATEGORILERI.find((k) => k.kod === kod)?.ad ?? kod;
}

export const ODEME_DURUMLARI = {
  BEKLIYOR: "Ödeme Bekliyor",
  KISMI: "Eksik Ödeme",
  ODENDI: "Tamam Ödendi",
} as const;

export type OdemeDurumu = keyof typeof ODEME_DURUMLARI;

export function odemeDurumuAdi(kod: string): string {
  return ODEME_DURUMLARI[kod as OdemeDurumu] ?? kod;
}
