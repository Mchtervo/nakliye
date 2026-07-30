/**
 * Kayıtlı web siteleri — yeni site eklemek için:
 * 1. lib/kaynaklar/siteler/<slug>.ts (SiteTarayici)
 * 2. Aşağıdaki WEB_SITELER dizisine ekle
 * Cron + Ayarlar Duraklat/Başlat gerisini halleder.
 */
import { prisma } from "@/lib/prisma";
import type { SiteRapor, SiteTarayici } from "@/lib/kaynaklar/siteler/tip";
import { yuklegelSite } from "@/lib/kaynaklar/siteler/yuklegel";

/** Tüm bilinen site tarayıcıları. */
export const WEB_SITELER: SiteTarayici[] = [yuklegelSite];

export type SiteTurRapor = {
  slug: string;
  ad: string;
  atlandi: boolean;
  neden?: string;
  rapor?: SiteRapor;
};

/** IlanKaynagi satırını oluştur / güncelle (aktif'e dokunma). */
export async function siteKaynaginiGarantiEt(
  site: SiteTarayici
): Promise<{ id: number; aktif: boolean }> {
  const mevcut = await prisma.ilanKaynagi.findFirst({
    where: { tur: "WEB", hedef: site.hedef },
    select: { id: true, aktif: true },
  });
  if (mevcut) {
    await prisma.ilanKaynagi.update({
      where: { id: mevcut.id },
      data: { ad: site.ad, durum: "AKTIF" },
    });
    return mevcut;
  }
  const yeni = await prisma.ilanKaynagi.create({
    data: {
      tur: "WEB",
      ad: site.ad,
      hedef: site.hedef,
      aktif: site.varsayilanAktif !== false,
      durum: "AKTIF",
      oncelik: 1,
    },
  });
  return { id: yeni.id, aktif: yeni.aktif };
}

/**
 * Aktif siteleri tara. Duraklatılmış (aktif=false) atlanır.
 */
export async function aktifSiteleriTara(): Promise<SiteTurRapor[]> {
  const sonuc: SiteTurRapor[] = [];

  for (const site of WEB_SITELER) {
    const kaynak = await siteKaynaginiGarantiEt(site);
    if (!kaynak.aktif) {
      sonuc.push({
        slug: site.slug,
        ad: site.ad,
        atlandi: true,
        neden: "Ayarlar'da duraklatıldı",
      });
      continue;
    }

    try {
      const rapor = await site.tara();
      // Site kendi bulunanAdet/sonTarama güncelleyebilir; yoksa burada yaz.
      await prisma.ilanKaynagi.update({
        where: { id: kaynak.id },
        data: {
          sonTarama: new Date(),
          sonHata:
            rapor.hatalar.length > 0
              ? rapor.hatalar.join(" | ").slice(0, 400)
              : null,
        },
      });
      sonuc.push({ slug: site.slug, ad: site.ad, atlandi: false, rapor });
    } catch (e) {
      const mesaj = e instanceof Error ? e.message : "bilinmeyen hata";
      await prisma.ilanKaynagi.update({
        where: { id: kaynak.id },
        data: { sonTarama: new Date(), sonHata: mesaj.slice(0, 400) },
      });
      sonuc.push({
        slug: site.slug,
        ad: site.ad,
        atlandi: false,
        rapor: { kayit: 0, hatalar: [mesaj] },
      });
    }
  }

  return sonuc;
}
