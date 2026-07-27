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
 * HEM çıkış HEM varış koridorda mı?
 * "Bir uç yeter" YOK — Ankara→Antalya elenir.
 */
export function koridoraUyuyorMu(
  koridorIller: string[],
  cikisIl: string | null | undefined,
  varisIl: string | null | undefined
): boolean {
  const kapsam = new Set(koridorIlKumesi(koridorIller));
  // Boş koridor = filtre kapalı (Türkiye)
  if (kapsam.size === 0) return true;
  const cikis = ilBul(cikisIl);
  const varis = ilBul(varisIl);
  if (!cikis || !varis) return false;
  return kapsam.has(cikis) && kapsam.has(varis);
}

/** Panel placeholder / doğrulama için. */
export function bilinenIlMi(ad: string): boolean {
  return ilBul(ad) !== null;
}
