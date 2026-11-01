/** İlan fiyatı akıl sınırları; istemcide de kullanılır (veritabanı / AI içermez). */

/** Komple navlun / ton başı akıl sınırları (TL). */
export const FIYAT_AKIL = {
  kompleMin: 2_000,
  kompleMax: 150_000,
  tonMin: 200,
  tonMax: 5_000,
} as const;

/** Kayıtlı fiyat mantıklı mı? (kuruş cinsinden alanlar) */
export function fiyatAkliDisiMi(ilan: {
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz?: boolean;
}): boolean {
  if (ilan.fiyatBelirsiz) return true;
  if (ilan.ucret != null && ilan.ucret > 0) {
    const tl = ilan.ucret / 100;
    if (tl < FIYAT_AKIL.kompleMin || tl > FIYAT_AKIL.kompleMax) return true;
  }
  if (ilan.fiyatTon != null && ilan.fiyatTon > 0) {
    const tl = ilan.fiyatTon / 100;
    if (tl < FIYAT_AKIL.tonMin || tl > FIYAT_AKIL.tonMax) return true;
  }
  return false;
}
