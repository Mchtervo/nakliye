import type { AiTercihleri } from "@/lib/ayarlar";
import { aracMetniUyuyorMu } from "@/lib/arac";
import { bolgeyeUyuyorMu, cekirdekIlKumesi } from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

/** Varsayılan listede gösterilmeyen, "Şüpheli" sekmesine düşen sınır. */
export const SUPHE_SINIRI = 50;

type AracBilgisi = {
  aracTipi?: string | null;
  aracTipiKod: string | null;
  tonaj: number | null;
};

/**
 * Araç uyumu (FAZ 3):
 * - Seçili tipin kabul kelimeleri / kodu
 * - Red tip kelimeleri (frigo, damper, lowbed…) ele
 * - Tipi yazmayan ilan elenmez (belirsiz → sarı uyarı)
 */
export function araciUyuyorMu(
  ilan: AracBilgisi,
  tercih: AiTercihleri
): boolean {
  if (
    !aracMetniUyuyorMu(ilan.aracTipi, ilan.aracTipiKod, tercih.aracTipleri)
  ) {
    return false;
  }
  if (tercih.maxTonaj && ilan.tonaj && ilan.tonaj > tercih.maxTonaj) {
    return false;
  }
  return true;
}

/**
 * Kullanıcıyı gerçekten ilgilendiren ilanları seçer.
 * Dönüş yükü eşleşmesi her zaman ilgilidir.
 * Bölge: en az bir uç seçili bölge / ek ile değsin.
 */
export function ilgiliMi(ilan: KaydedilenIlan, tercih: AiTercihleri): boolean {
  if (ilan.donusTalebiId) return true;
  if (ilan.guvenSkoru < SUPHE_SINIRI) return false;
  if (!araciUyuyorMu(ilan, tercih)) return false;

  const komple = ilan.ucret;
  if (tercih.minUcret && komple !== null && komple < tercih.minUcret) {
    return false;
  }

  // Bölge filtresi (komşular + ek iller dahil)
  if (
    (tercih.bolgeler.length > 0 || tercih.ekIller.length > 0) &&
    !bolgeyeUyuyorMu(
      tercih.bolgeler,
      ilan.cikisIl,
      ilan.varisIl,
      tercih.ekIller
    )
  ) {
    return false;
  }

  const sehir = ilBul(tercih.sehir) ?? tercih.anaUs;
  if (sehir && (ilan.cikisIl === sehir || ilan.varisIl === sehir)) {
    return true;
  }

  for (const rota of tercih.rotalar) {
    const [a, b] = rota.split(/[->→]+/).map((p) => ilBul(p));
    if (!a) continue;
    if (b) {
      if (ilan.cikisIl === a && ilan.varisIl === b) return true;
    } else if (ilan.cikisIl === a || ilan.varisIl === a) {
      return true;
    }
  }

  // Şehir/rota daraltması yoksa bölge eşleşmesi yeter.
  if (!sehir && tercih.rotalar.length === 0) return true;

  // Şehir veya rota girilmiş ama bu ilan onlara uymuyor; yine de bölgeye
  // değiyorsa göster (dönüş yükü mantığı — diğer uç serbest).
  return tercih.bolgeler.length > 0 || tercih.ekIller.length > 0;
}

export function ilgilileriSuz(
  ilanlar: KaydedilenIlan[],
  tercih: AiTercihleri
): KaydedilenIlan[] {
  return ilanlar.filter((i) => ilgiliMi(i, tercih));
}

/**
 * Aynı tercihlerin veritabanı karşılığı. Liste sayfası binlerce satırı
 * belleğe çekmesin diye süzme sorguda yapılır.
 */
export function tercihKosulu(tercih: AiTercihleri) {
  const kosullar: Record<string, unknown>[] = [
    { guvenSkoru: { gte: SUPHE_SINIRI } },
  ];

  if (tercih.aracTipleri.length > 0) {
    // Belirsiz (null) artık listede değil — damper/frigo kaçmasın.
    kosullar.push({
      aracTipiKod: { in: tercih.aracTipleri as string[] },
    });
  }
  if (tercih.maxTonaj) {
    kosullar.push({ OR: [{ tonaj: null }, { tonaj: { lte: tercih.maxTonaj } }] });
  }

  if (tercih.bolgeler.length > 0 || tercih.ekIller.length > 0) {
    const iller = cekirdekIlKumesi(tercih.bolgeler, tercih.ekIller);
    kosullar.push({
      OR: [{ cikisIl: { in: iller } }, { varisIl: { in: iller } }],
    });
  }

  return { AND: kosullar };
}
