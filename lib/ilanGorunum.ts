import { tlYazKisa } from "@/lib/para";

export type FiyatAlanlari = {
  ucret: number | null; // kuruş, komple
  fiyatTon: number | null; // kuruş, ton başı
  fiyatBelirsiz?: boolean;
  tonaj?: number | null;
};

export type FiyatGorunumu = {
  /** Ekranda büyük yazılan tutar. */
  ana: string | null;
  /** Ton başı fiyattan hesaplanan tahmini komple. Gerçek fiyat değildir. */
  tahmin: string | null;
  /** Fiyat var ama ton mu komple mi anlaşılmadı. */
  belirsiz: boolean;
};

/**
 * "900+KDV" ton başıdır, "38.000" komple. İkisini aynı biçimde yazmak
 * kullanıcıyı 24 kat yanıltıyor; bu yüzden tür her zaman gösterilir.
 */
export function fiyatGorunumu(ilan: FiyatAlanlari): FiyatGorunumu {
  if (ilan.fiyatTon !== null && ilan.fiyatTon > 0) {
    const tonaj = ilan.tonaj ?? null;
    return {
      ana: `${tlYazKisa(ilan.fiyatTon)}/ton`,
      tahmin: tonaj
        ? `~${tlYazKisa(ilan.fiyatTon * tonaj)} (${tonaj} ton)`
        : null,
      belirsiz: false,
    };
  }

  if (ilan.ucret !== null && ilan.ucret > 0) {
    return { ana: `${tlYazKisa(ilan.ucret)} komple`, tahmin: null, belirsiz: false };
  }

  return { ana: null, tahmin: null, belirsiz: Boolean(ilan.fiyatBelirsiz) };
}

/** "12 dk önce", "3 saat önce", "2 gün önce" */
export function gecenSure(tarih: Date): string {
  const dakika = Math.floor((Date.now() - tarih.getTime()) / 60000);
  if (dakika < 1) return "az önce";
  if (dakika < 60) return `${dakika} dk önce`;
  const saat = Math.floor(dakika / 60);
  if (saat < 24) return `${saat} saat önce`;
  return `${Math.floor(saat / 24)} gün önce`;
}
