/**
 * Site tarayıcı ortak arayüz.
 * Yeni site: lib/kaynaklar/siteler/<slug>.ts yaz → kayit.ts'e ekle.
 * Cron + Ayarlar (aktif/pasif) otomatik çalışır.
 */

export type SiteRapor = {
  kayit: number;
  hatalar: string[];
  /** Siteye özel ek alanlar (log için). */
  [key: string]: unknown;
};

export type SiteTarayici = {
  /** Benzersiz kimlik — IlanKaynagi.hedef ile eşleşir. */
  slug: string;
  ad: string;
  /** Canonical URL (IlanKaynagi.hedef). */
  hedef: string;
  aciklama: string;
  /** Varsayılan: açık. */
  varsayilanAktif?: boolean;
  tara: () => Promise<SiteRapor>;
};
