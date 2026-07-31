import type { AiTercihleri } from "@/lib/ayarlar";
import { aracKoduBul, aracMetniUyuyorMu } from "@/lib/arac";
import { koridorIlKumesi, koridoraUyuyorMu } from "@/lib/koridor";
import { ilBul } from "@/lib/iller";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";
import { rotaSatiriniBul } from "@/lib/kaynaklar/rotaDogrula";

/**
 * Bildirim + "Şüpheli" sekmesi eşiği.
 * Kayıt eşiği ayrı: GUVEN_MIN_KAYIT = 15 (lib/ai/ilanCozumle).
 * guven 30 → kayda girer, bildirilmez (şüpheli).
 */
export const SUPHE_SINIRI = 50;

type AracBilgisi = {
  aracTipi?: string | null;
  aracTipiKod: string | null;
  tonaj: number | null;
  nereden?: string | null;
  nereye?: string | null;
};

/**
 * Araç uyumu (FAZ 3):
 * - Seçili tipin kabul kelimeleri / kodu
 * - Red tip kelimeleri (frigo, damper, lowbed, kısadorse…) ele
 * - Tipi yazmayan ilan elenmez (belirsiz → sarı uyarı)
 * - hamMetin verilirse yalnızca o rotanın satırı taranır (liste karışmasın)
 */
export function araciUyuyorMu(
  ilan: AracBilgisi,
  tercih: AiTercihleri,
  hamMetin?: string | null
): boolean {
  const satir =
    hamMetin && ilan.nereden && ilan.nereye
      ? rotaSatiriniBul(ilan.nereden, ilan.nereye, hamMetin)
      : null;
  const birlesik = [ilan.aracTipi, satir].filter(Boolean).join(" ");
  const kod =
    ilan.aracTipiKod ||
    aracKoduBul(ilan.aracTipi) ||
    (satir ? aracKoduBul(satir) : null);

  if (!aracMetniUyuyorMu(birlesik || ilan.aracTipi, kod, tercih.aracTipleri)) {
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
 * Koridor: HEM çıkış HEM varış listede.
 */
export function ilgiliMi(ilan: KaydedilenIlan, tercih: AiTercihleri): boolean {
  if (ilan.donusTalebiId) return true;
  if (ilan.guvenSkoru < SUPHE_SINIRI) return false;
  if (!araciUyuyorMu(ilan, tercih)) return false;

  const komple = ilan.ucret;
  if (tercih.minUcret && komple !== null && komple < tercih.minUcret) {
    return false;
  }

  if (
    !koridoraUyuyorMu(tercih.koridorIller, ilan.cikisIl, ilan.varisIl)
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

  // Koridora uyuyorsa (yukarıda geçti) şehir/rota daraltması yoksa göster.
  if (!sehir && tercih.rotalar.length === 0) return true;

  // Şehir/rota girilmiş ama uymuyor — yine de koridor içiyse göster.
  return true;
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
/**
 * Liste sayfası filtresi.
 * Skor 40+ yeter (50 altı eskiden paneli boşaltıyordu; şüpheli sekmesi ayrı).
 * WEB kaynak (yuklegel vb.) sadece müşteri havuzunda — panelde yok.
 */
export function tercihKosulu(tercih: AiTercihleri) {
  const kosullar: Record<string, unknown>[] = [
    { guvenSkoru: { gte: 40 } },
    webKaynakHaricKosulu(),
  ];

  if (tercih.aracTipleri.length > 0) {
    // Belirsiz (null) geçsin — damper/frigo kodu olanlar zaten listede değil.
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

  const iller = koridorIlKumesi(tercih.koridorIller);
  if (iller.length > 0) {
    kosullar.push({ cikisIl: { in: iller } });
    kosullar.push({ varisIl: { in: iller } });
  }

  return { AND: kosullar };
}

/** YukIlani: WEB kaynaklı kayıtları ana akıştan çıkar. */
export function webKaynakHaricKosulu() {
  return {
    OR: [
      { kaynakId: null },
      { kaynak: { tur: { not: "WEB" } } },
    ],
  };
}
