/** İstemcide de kullanılabilen müşteri yardımcıları (veritabanı içermez). */
export type MusteriSinif = "YUK_SAHIBI" | "KOMISYONCU" | "KARISIK";

export function telefonGorunum(tel10: string): string {
  if (tel10.length !== 10) return tel10;
  return `0${tel10.slice(0, 3)} ${tel10.slice(3, 6)} ${tel10.slice(6)}`;
}
