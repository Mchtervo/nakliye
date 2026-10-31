/**
 * Süreli belgeler (muayene, sigorta, kasko, takograf, SRC…).
 * Bitişe 30 / 7 / 1 gün kala ve geçince birer kez bildirim.
 */
export const BELGE_TURLERI = [
  { kod: "MUAYENE", ad: "Araç muayenesi" },
  { kod: "SIGORTA", ad: "Trafik sigortası" },
  { kod: "KASKO", ad: "Kasko" },
  { kod: "TAKOGRAF", ad: "Takograf kalibrasyonu" },
  { kod: "SRC", ad: "SRC belgesi" },
  { kod: "PSIKOTEKNIK", ad: "Psikoteknik" },
  { kod: "EHLIYET", ad: "Ehliyet" },
  { kod: "K_BELGESI", ad: "K belgesi" },
  { kod: "DIGER", ad: "Diğer" },
] as const;

export type BelgeTuru = (typeof BELGE_TURLERI)[number]["kod"];

export function belgeAdi(tur: string, ad?: string | null): string {
  if (ad?.trim()) return ad.trim();
  return BELGE_TURLERI.find((t) => t.kod === tur)?.ad ?? tur;
}

const GUN_MS = 24 * 60 * 60 * 1000;

/** Bugünden bitişe kalan gün (bitiş günü dahil; geçtiyse negatif). */
export function kalanGun(bitis: Date, simdi = new Date()): number {
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  const son = new Date(bitis.getFullYear(), bitis.getMonth(), bitis.getDate());
  return Math.round((son.getTime() - bugun.getTime()) / GUN_MS);
}

/** 0 yok, 1 ≤30 gün, 2 ≤7 gün, 3 ≤1 gün, 4 geçti */
export function uyariSeviyesi(kalan: number): number {
  if (kalan < 0) return 4;
  if (kalan <= 1) return 3;
  if (kalan <= 7) return 2;
  if (kalan <= 30) return 1;
  return 0;
}
