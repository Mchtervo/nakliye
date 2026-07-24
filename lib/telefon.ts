/** Telefonu tel: linki için +90... biçimine çevirir. */
export function telefonTelHref(ham: string): string | null {
  let t = ham.replace(/[\s\-()]/g, "");
  if (!t) return null;
  if (t.startsWith("00")) t = "+" + t.slice(2);
  if (t.startsWith("0") && t.length >= 10) t = "+90" + t.slice(1);
  if (!t.startsWith("+") && /^90\d{10}$/.test(t)) t = "+" + t;
  if (!t.startsWith("+") && /^5\d{9}$/.test(t)) t = "+90" + t;
  if (!/^\+\d{10,15}$/.test(t)) return null;
  return `tel:${t}`;
}

/** Ekranda gösterim: 05XX XXX XX XX */
export function telefonGoster(ham: string): string {
  const href = telefonTelHref(ham);
  if (!href) return ham.trim();
  const rakam = href.replace("tel:+90", "0").replace("tel:", "");
  if (rakam.length === 11 && rakam.startsWith("0")) {
    return `${rakam.slice(0, 4)} ${rakam.slice(4, 7)} ${rakam.slice(7, 9)} ${rakam.slice(9)}`;
  }
  return rakam;
}
