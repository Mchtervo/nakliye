export type GiderGrubu =
  | "ARAC"
  | "YOL"
  | "VERGI_SIGORTA"
  | "ISLETME"
  | "YATIRIM"
  | "DIGER"
  | "ESKI";

export type GiderKategorisi = {
  kod: string;
  ad: string;
  grup: GiderGrubu;
  /** Yeni kayıt formunda "Eski kayıtlar" altında gösterilir. */
  eski?: boolean;
  /** OCR ve AI eşleştirmesi için ipucu kelimeler. */
  ipuclari?: string[];
};

/**
 * Kod alanları veritabanında saklandığı için ASLA değiştirilmez/silinmez.
 * Yeni tür eklenir; karşılığı bölünen eski türler `eski: true` ile kalır.
 */
export const GIDER_KATEGORILERI: readonly GiderKategorisi[] = [
  { kod: "YAKIT", ad: "Yakıt", grup: "ARAC", ipuclari: ["motorin", "dizel", "akaryakıt", "petrol", "opet", "shell", "bp", "po"] },
  { kod: "LASTIK", ad: "Lastik", grup: "ARAC", ipuclari: ["lastik", "jant", "balans", "rot"] },
  { kod: "TAMIR", ad: "Tamir", grup: "ARAC", ipuclari: ["tamir", "arıza", "yedek parça", "kaporta", "elektrik"] },
  { kod: "BAKIM", ad: "Bakım / Onarım", grup: "ARAC", ipuclari: ["bakım", "yağ değişimi", "filtre", "servis"] },

  { kod: "OGS", ad: "OGS", grup: "YOL", ipuclari: ["ogs", "otomatik geçiş"] },
  { kod: "HGS", ad: "HGS", grup: "YOL", ipuclari: ["hgs", "hızlı geçiş", "köprü", "otoyol geçiş"] },

  { kod: "KASKO", ad: "Kasko", grup: "VERGI_SIGORTA", ipuclari: ["kasko"] },
  { kod: "TRAFIK_SIGORTA", ad: "Trafik Sigortası", grup: "VERGI_SIGORTA", ipuclari: ["trafik sigortası", "zorunlu mali", "zmss"] },
  { kod: "MUAYENE", ad: "Muayene", grup: "VERGI_SIGORTA", ipuclari: ["muayene", "tüvtürk", "fenni"] },
  { kod: "MTV", ad: "MTV", grup: "VERGI_SIGORTA", ipuclari: ["mtv", "motorlu taşıtlar vergisi"] },

  { kod: "TELEFON", ad: "Telefon / İnternet", grup: "ISLETME", ipuclari: ["telefon", "turkcell", "vodafone", "türk telekom", "internet", "hat"] },
  { kod: "MUHASEBE", ad: "Muhasebe", grup: "ISLETME", ipuclari: ["muhasebe", "mali müşavir", "smmm", "serbest muhasebeci"] },
  { kod: "PERSONEL", ad: "Personel", grup: "ISLETME", ipuclari: ["maaş", "personel", "şoför", "sgk", "prim"] },
  { kod: "YEMEK", ad: "Yemek", grup: "ISLETME", ipuclari: ["yemek", "lokanta", "restoran", "market", "kahvaltı"] },
  { kod: "KONAKLAMA", ad: "Konaklama", grup: "ISLETME", ipuclari: ["otel", "konaklama", "pansiyon", "motel"] },

  { kod: "DEMIRBAS", ad: "Demirbaş (tır, dorse, ekipman)", grup: "YATIRIM", ipuclari: ["tır", "çekici", "dorse", "römork", "ekipman"] },
  { kod: "KREDI_ODEME", ad: "Kredi ödemesi", grup: "YATIRIM", ipuclari: ["kredi", "taksit", "finansman", "leasing"] },

  { kod: "DIGER", ad: "Diğer", grup: "DIGER" },

  // Bölünmüş eski türler: yeni kayıtta önerilmez ama veriler korunur.
  { kod: "OTOYOL", ad: "Otoyol / Köprü (eski)", grup: "ESKI", eski: true },
  { kod: "SIGORTA", ad: "Sigorta / Kasko (eski)", grup: "ESKI", eski: true },
  { kod: "VERGI", ad: "Vergi / Harç (eski)", grup: "ESKI", eski: true },
] as const;

export const GIDER_GRUP_ADLARI: Record<GiderGrubu, string> = {
  ARAC: "Araç",
  YOL: "Yol / Geçiş",
  VERGI_SIGORTA: "Vergi & Sigorta",
  ISLETME: "İşletme",
  YATIRIM: "Yatırım / Finans",
  DIGER: "Diğer",
  ESKI: "Eski kayıtlar",
};

const GRUP_SIRASI: GiderGrubu[] = [
  "ARAC",
  "YOL",
  "VERGI_SIGORTA",
  "ISLETME",
  "YATIRIM",
  "DIGER",
  "ESKI",
];

/** Formdaki <optgroup> yapısı için kategorileri gruplar. */
export function giderKategoriGruplari(): {
  grup: GiderGrubu;
  ad: string;
  kategoriler: GiderKategorisi[];
}[] {
  return GRUP_SIRASI.map((grup) => ({
    grup,
    ad: GIDER_GRUP_ADLARI[grup],
    kategoriler: GIDER_KATEGORILERI.filter((k) => k.grup === grup),
  })).filter((g) => g.kategoriler.length > 0);
}

export function gecerliKategoriMi(kod: string): boolean {
  return GIDER_KATEGORILERI.some((k) => k.kod === kod);
}

/** Demirbaş işletme gideri sayılmaz; KDV yine takip edilir. */
export function demirbasMi(kod: string): boolean {
  return kod === "DEMIRBAS";
}

export function isletmeGideriMi(kod: string): boolean {
  return !demirbasMi(kod);
}

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
