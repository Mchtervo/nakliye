import type { AiTercihleri } from "@/lib/ayarlar";
import { bolgeIlleri, bolgeyeUyuyorMu } from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

/** Varsayılan listede gösterilmeyen, "Şüpheli" sekmesine düşen sınır. */
export const SUPHE_SINIRI = 50;

type AracBilgisi = {
  aracTipiKod: string | null;
  tonaj: number | null;
};

/**
 * Araç uyumu. Tipi veya tonajı yazmayan ilan elenmez: ilanların çoğunda
 * bu bilgi yok, elense liste boş kalır.
 */
export function araciUyuyorMu(
  ilan: AracBilgisi,
  tercih: AiTercihleri
): boolean {
  if (
    tercih.aracTipleri.length > 0 &&
    ilan.aracTipiKod &&
    !tercih.aracTipleri.includes(ilan.aracTipiKod as never)
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
 */
export function ilgiliMi(ilan: KaydedilenIlan, tercih: AiTercihleri): boolean {
  if (ilan.donusTalebiId) return true;
  if (ilan.guvenSkoru < SUPHE_SINIRI) return false;
  if (!araciUyuyorMu(ilan, tercih)) return false;

  const komple = ilan.ucret;
  if (tercih.minUcret && komple !== null && komple < tercih.minUcret) {
    return false;
  }

  const sehir = ilBul(tercih.sehir) ?? tercih.anaUs;
  if (sehir && ilan.cikisIl === sehir) return true;

  for (const rota of tercih.rotalar) {
    const [a, b] = rota.split(/[->→]+/).map((p) => ilBul(p));
    if (!a) continue;
    if (b) {
      if (ilan.cikisIl === a && ilan.varisIl === b) return true;
    } else if (ilan.cikisIl === a || ilan.varisIl === a) {
      return true;
    }
  }

  // Şehir/rota girilmemişse bölge tercihi belirleyici olur.
  if (!sehir && tercih.rotalar.length === 0) {
    return bolgeyeUyuyorMu(tercih.bolgeler, ilan.cikisIl, ilan.varisIl);
  }
  return false;
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
    kosullar.push({
      OR: [
        { aracTipiKod: null },
        { aracTipiKod: { in: tercih.aracTipleri as string[] } },
      ],
    });
  }
  if (tercih.maxTonaj) {
    kosullar.push({ OR: [{ tonaj: null }, { tonaj: { lte: tercih.maxTonaj } }] });
  }

  const sehir = ilBul(tercih.sehir) ?? tercih.anaUs;
  if (sehir) {
    kosullar.push({ OR: [{ cikisIl: sehir }, { varisIl: sehir }] });
  } else if (tercih.bolgeler.length > 0) {
    const iller = bolgeIlleri(tercih.bolgeler);
    kosullar.push({
      OR: [{ cikisIl: { in: iller } }, { varisIl: { in: iller } }],
    });
  }

  return { AND: kosullar };
}
