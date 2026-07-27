/** Client-safe WhatsApp yardımcılar (AI/prisma yok). */

/** 0532 394 41 04 → 905323944104 */
export function telefonWaMe(telefon: string | null | undefined): string | null {
  if (!telefon) return null;
  const rakam = telefon.replace(/\D/g, "");
  if (rakam.length < 10) return null;
  const e164 = rakam.startsWith("90")
    ? rakam.slice(0, 12)
    : rakam.startsWith("0")
      ? `90${rakam.slice(1, 11)}`
      : `90${rakam.slice(0, 10)}`;
  if (e164.length < 12) return null;
  return e164;
}

export function whatsappMesajUrl(
  telefon: string | null | undefined,
  metin: string
): string | null {
  const e164 = telefonWaMe(telefon);
  if (!e164) return null;
  const base = `https://wa.me/${e164}`;
  if (!metin.trim()) return base;
  return `${base}?text=${encodeURIComponent(metin)}`;
}
