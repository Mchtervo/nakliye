/** Tır satırı ve hesabı — veritabanı bağımlılığı yok (istemcide de kullanılır). */
export type TirSatiri = {
  id: number;
  /** Plaka (yoksa "Tır 1") */
  etiket: string;
  sofor: string | null;
  /** Seferler, KDV hariç */
  gelir: number;
  /** Seferlerin KDV'si (hesaplanan / tahsil edilecek KDV) */
  gelirKdv: number;
  /** İşletme gideri (demirbaş hariç), KDV hariç */
  gider: number;
  /** Tüm giderlerin KDV'si (indirilecek KDV; demirbaş dahil) */
  giderKdv: number;
  sefer: number;
};

/** Kâr (KDV hariç gelir − gider) ve KDV farkı (+ ödenecek, − devreden). */
export function tirHesabi(s: TirSatiri) {
  return { kar: s.gelir - s.gider, kdvOdenecek: s.gelirKdv - s.giderKdv };
}

/** Satırların toplamı ("Tüm tırlar"). */
export function tirToplami(satirlar: TirSatiri[]): TirSatiri {
  return satirlar.reduce(
    (t, s) => ({
      ...t,
      gelir: t.gelir + s.gelir,
      gelirKdv: t.gelirKdv + s.gelirKdv,
      gider: t.gider + s.gider,
      giderKdv: t.giderKdv + s.giderKdv,
      sefer: t.sefer + s.sefer,
    }),
    { id: 0, etiket: "Tüm tırlar", sofor: null, gelir: 0, gelirKdv: 0, gider: 0, giderKdv: 0, sefer: 0 }
  );
}
