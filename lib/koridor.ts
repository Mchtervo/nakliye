/**
 * Ankara–İstanbul koridoru: AI prompt + sunucu filtresi aynı liste.
 * Panelden (`ai_koridor_iller`) genişletilir/daraltılır.
 */
import { ilBul } from "@/lib/iller";

/** Varsayılan koridor — kod dışı genişletme Ayarlar'dan. */
export const VARSAYILAN_KORIDOR_ILLER: readonly string[] = [
  "Ankara",
  "Kırıkkale",
  "Çankırı",
  "Bolu",
  "Düzce",
  "Sakarya",
  "Kocaeli",
  "İstanbul",
] as const;

/** Virgüllü / satırlı ham metinden geçerli il listesi. */
export function koridorIlleriCozumle(
  ham: string | null | undefined
): string[] {
  if (ham === undefined || ham === null) {
    return [...VARSAYILAN_KORIDOR_ILLER];
  }
  const trim = ham.trim();
  // Boş string = bilerek tüm Türkiye (nadir); panel uyarı verir.
  if (trim === "") return [];

  const sonuc: string[] = [];
  for (const p of trim.split(/[,\n;]/)) {
    const il = ilBul(p.trim());
    if (il && !sonuc.includes(il)) sonuc.push(il);
  }
  return sonuc;
}

/** Tercihten koridor kümesi. Ayar yoksa varsayılan 8 il. */
export function koridorIlKumesi(
  koridorIller: string[] | null | undefined
): string[] {
  if (koridorIller === undefined || koridorIller === null) {
    return [...VARSAYILAN_KORIDOR_ILLER];
  }
  if (koridorIller.length === 0) return [];
  return [...koridorIller];
}

/**
 * Koridor sınıflandırması:
 * - TAM   = çıkış VE varış koridorda → bildirim + Yeni sekmesi
 * - VARIS = sadece varış koridorda (Elazığ→Ankara) → Dönüş sekmesi, bildirim yok
 * - CIKIS = sadece çıkış koridorda → kaydetme, sadece say
 * - DISI  = ikisi de dışarıda → kaydetme
 */
export type KoridorTipi = "TAM" | "VARIS" | "CIKIS" | "DISI";

export function koridorTipiBelirle(
  koridorIller: string[] | Set<string> | null | undefined,
  cikisIl: string | null | undefined,
  varisIl: string | null | undefined
): KoridorTipi {
  const kapsam =
    koridorIller instanceof Set
      ? koridorIller
      : new Set(koridorIlKumesi(koridorIller));
  if (kapsam.size === 0) return "TAM"; // filtre kapalı
  const cikis = ilBul(cikisIl);
  const varis = ilBul(varisIl);
  if (!cikis || !varis) return "DISI";
  const cOk = kapsam.has(cikis);
  const vOk = kapsam.has(varis);
  if (cOk && vOk) return "TAM";
  if (vOk) return "VARIS";
  if (cOk) return "CIKIS";
  return "DISI";
}

/** HEM çıkış HEM varış koridorda mı? (bildirim / Yeni sekmesi) */
export function koridoraUyuyorMu(
  koridorIller: string[],
  cikisIl: string | null | undefined,
  varisIl: string | null | undefined
): boolean {
  return koridorTipiBelirle(koridorIller, cikisIl, varisIl) === "TAM";
}

/** Kayda alınır mı? TAM + VARIS (dönüş). CIKIS/DISI hayır. */
export function koridorKaydaAlinirMi(
  koridorIller: string[] | Set<string> | null | undefined,
  cikisIl: string | null | undefined,
  varisIl: string | null | undefined
): boolean {
  const tip = koridorTipiBelirle(koridorIller, cikisIl, varisIl);
  return tip === "TAM" || tip === "VARIS";
}

/** Panel placeholder / doğrulama için. */
export function bilinenIlMi(ad: string): boolean {
  return ilBul(ad) !== null;
}
