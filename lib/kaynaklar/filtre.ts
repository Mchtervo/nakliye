import type { AiTercihleri } from "@/lib/ayarlar";
import { bolgeyeUyuyorMu } from "@/lib/bolgeler";
import { ilBul } from "@/lib/iller";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

/**
 * Kullanıcıyı gerçekten ilgilendiren ilanları seçer.
 * Dönüş yükü eşleşmesi her zaman ilgilidir.
 */
export function ilgiliMi(ilan: KaydedilenIlan, tercih: AiTercihleri): boolean {
  if (ilan.donusTalebiId) return true;

  if (tercih.minUcret && ilan.ucret !== null && ilan.ucret < tercih.minUcret) {
    return false;
  }

  const sehir = ilBul(tercih.sehir);
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
