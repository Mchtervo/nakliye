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
 * Tip → kabul kelimeleri (FAZ 3). Eşleşme sadelestir sonrası yapılır.
 * Tenteli / kapalı kasa varsayılan araç; diğerleri red tarafına düşer.
 */
const TIP_KELIMELER: Record<AracTipiKodu, string[]> = {
  TENTELI: [
    "tenteli", "tente", "tenteli kasa", "branda", "brandali",
    "perdeli", "perde", "surgulu perde",
  ],
  KAPALI_KASA: ["kapali kasa", "kapali", "panelvan", "panel van", "box"],
  FRIGO: ["frigo", "frigorifik", "sogutuculu", "sogutmali", "termo"],
  DAMPER: ["damper", "damperli", "kaya tipi"],
  LOWBED: ["lowbed", "low bed", "lowbet", "havuzlu"],
  SAL_DORSE: [
    "sal dorse", "acik dorse", "acik kasa", "platform", "flatbed",
    "kisadorse", "kisa dorse", "kisa-dorse", "kisadors",
    // "sal" tek başına çok kısa; kelime sınırı ile bakılır
  ],
  KAMYON: ["kamyonet", "kirkayak", "10 teker", "6 teker", "kamyon"],
  DIGER: ["tanker", "silobas", "konteyner", "konteyner sasi", "romork", "havuz"],
};

/** Kod üretiminde kullanılan düz liste (öncelik: metinde ilk geçen). */
const ANAHTARLAR: { kod: AracTipiKodu; kelimeler: string[] }[] = (
  Object.entries(TIP_KELIMELER) as [AracTipiKodu, string[]][]
).map(([kod, kelimeler]) => ({ kod, kelimeler }));

function kelimeVar(sade: string, kelime: string): boolean {
  if (kelime.includes(" ")) return sade.includes(kelime);
  // Tek kelime: sınırlı eşleşme ("sal" → "saldir" olmasın)
  return new RegExp(`(^|\\s)${kelime}(\\s|$)`).test(sade);
}

function tipKelimeSkoru(sade: string, kod: AracTipiKodu): number {
  let skor = 0;
  for (const k of TIP_KELIMELER[kod]) {
    if (kelimeVar(sade, k)) skor += k.includes(" ") ? 2 : 1;
  }
  // "sal" özel: SAL_DORSE
  if (kod === "SAL_DORSE" && kelimeVar(sade, "sal")) skor += 1;
  return skor;
}

/**
 * "13.60 tır", "13,60 TIR", "1360 dorse" → metre (standart tenteli).
 * Navlun / fiyat DEĞİL — araç özelliği.
 */
export function tirUzunlukMetre(metin: string | null | undefined): number | null {
  if (!metin) return null;
  const ham = metin.replace(/\s+/g, " ");
  const kalip =
    /(?<!\d)(1[34][.,]60|1[34][.,]6|13\.?60|1360|14\.?60|1460)(?!\d)\s*(?:m|mt|metre)?\s*(?:tir|tır|dorse|tente|tenteli|treyler|trailer|mega|jumbo)/i;
  const ters =
    /(?:tir|tır|dorse|tente|tenteli|treyler|trailer|mega|jumbo)\s*(?:boyu|uzunluk|:)?\s*(?<!\d)(1[34][.,]60|1[34][.,]6|13\.?60|1360|14\.?60|1460)(?!\d)/i;
  const m = ham.match(kalip) || ham.match(ters);
  if (!m) return null;
  const hamSayi = m[1].replace(",", ".");
  if (hamSayi === "1360" || hamSayi === "13.60" || hamSayi === "13.6") return 13.6;
  if (hamSayi === "1460" || hamSayi === "14.60" || hamSayi === "14.6") return 14.6;
  const n = Number.parseFloat(hamSayi);
  if (!Number.isFinite(n) || n < 10 || n > 20) return null;
  return Math.round(n * 100) / 100;
}

/** Serbest metinden araç tipi kodunu çıkarır; anlaşılmazsa null. */
export function aracKoduBul(metin: string | null | undefined): AracTipiKodu | null {
  if (!metin) return null;
  const sade = sadelestir(metin);
  if (!sade) return null;

  let enIyi: { kod: AracTipiKodu; yer: number } | null = null;
  for (const { kod, kelimeler } of ANAHTARLAR) {
    for (const kelime of kelimeler) {
      const yer = sade.indexOf(kelime);
      if (yer < 0) continue;
      if (!enIyi || yer < enIyi.yer) enIyi = { kod, yer };
    }
  }
  if (!enIyi && kelimeVar(sade, "sal")) return "SAL_DORSE";
  return enIyi?.kod ?? null;
}

/**
 * Seçili araç tiplerine uyuyor mu?
 * - Tip yazılmamışsa eleme (belirsiz → kartta sarı uyarı).
 * - Red kelimesi var, kabul yoksa ele.
 * - Kod seçilenlerin dışındaysa ele.
 * - "açık veya kapalı" → tenteli/kapalı kabul edenler için OK.
 * - kısadorse → sal dorse kabul edilmiyorsa RED.
 */
export function aracMetniUyuyorMu(
  aracTipi: string | null | undefined,
  aracTipiKod: string | null | undefined,
  kabulKodlari: AracTipiKodu[]
): boolean {
  if (kabulKodlari.length === 0) return true;

  const kod =
    (aracTipiKod as AracTipiKodu | null) ||
    aracKoduBul(aracTipi);
  const sade = sadelestir(aracTipi || "");

  if (!sade && !kod) return true; // belirsiz — geçir

  // kısadorse / kısa dorse — sal dorse değilse kesin red
  if (
    /(^|\s)(kisadorse|kisadors|kisa dorse|kisa-dorse)(\s|$)/.test(sade) &&
    !kabulKodlari.includes("SAL_DORSE")
  ) {
    return false;
  }

  // "açık veya kapalı" / "açık/kapalı" — kapalı seçeneği var → kabul
  if (
    /acik\s*(veya|\/|,|\+|ve)\s*kapali|kapali\s*(veya|\/|,|\+|ve)\s*acik/.test(
      sade
    ) &&
    (kabulKodlari.includes("TENTELI") ||
      kabulKodlari.includes("KAPALI_KASA"))
  ) {
    return true;
  }

  if (kod && !kabulKodlari.includes(kod)) return false;

  let kabulSkor = 0;
  for (const k of kabulKodlari) kabulSkor += tipKelimeSkoru(sade, k);

  let redSkor = 0;
  for (const tip of ARAC_TIPLERI) {
    if (kabulKodlari.includes(tip.kod)) continue;
    redSkor += tipKelimeSkoru(sade, tip.kod);
  }

  if (redSkor > 0 && kabulSkor === 0) return false;
  return true;
}

/** Araç tipi belirtilmemiş mi (sarı uyarı için). */
export function aracBelirsizMi(
  aracTipi: string | null | undefined,
  aracTipiKod: string | null | undefined
): boolean {
  if (aracTipiKod) return false;
  return !sadelestir(aracTipi || "");
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

/**
 * Yer adı gibi görünen ama araç tipi olan kelimeler.
 * "Çanakkale→Kırkayak" uydurmasını sunucuda kesmek için.
 */
const YER_KARA_EK = [
  "kirkayak", "kir kayak", "sinirsiz damper", "tir",
  "dorse", "treyler", "trailer", "cekici", "lorry",
  "mega", "jumbo", "tent", "frigo", "damper", "lowbed",
  "silobas", "tanker", "konteyner", "romork",
  "kisadorse", "kisa dorse",
];

let yerKaraSet: Set<string> | null = null;

function yerKaraKumesi(): Set<string> {
  if (yerKaraSet) return yerKaraSet;
  const s = new Set<string>();
  for (const kelimeler of Object.values(TIP_KELIMELER)) {
    for (const k of kelimeler) s.add(k);
  }
  s.add("sal");
  for (const k of YER_KARA_EK) s.add(sadelestir(k));
  yerKaraSet = s;
  return s;
}

/** Bu metin yer adı değil, araç tipi / ekipman mı? */
export function aracYerAdiMi(yer: string | null | undefined): boolean {
  const sade = sadelestir(yer || "");
  if (!sade) return false;
  const kara = yerKaraKumesi();
  if (kara.has(sade)) return true;
  // "sinirsiz damper", "10 teker kirkayak"
  for (const k of kara) {
    if (k.length >= 4 && (sade === k || sade.includes(` ${k}`) || sade.includes(`${k} `))) {
      return true;
    }
  }
  return aracKoduBul(yer) !== null && !sade.includes(" "); // tek kelime araç kodu
}
