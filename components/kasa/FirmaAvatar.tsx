const TONLAR = [
  "from-[#60a5fa] to-[#2563eb]",
  "from-[#a78bfa] to-[#6d28d9]",
  "from-[#fdba74] to-[#ea580c]",
  "from-[#6ee7b7] to-[#059669]",
  "from-[#f9a8d4] to-[#db2777]",
];

/** "ABC Lojistik" → "AB", "Örnek Nakliyat" → "ÖN" */
export function basHarfler(ad: string) {
  const kelimeler = ad.trim().split(/\s+/).filter(Boolean);
  const harf = kelimeler.length > 1 ? kelimeler[0][0] + kelimeler[1][0] : (kelimeler[0] ?? "?").slice(0, 2);
  return harf.toLocaleUpperCase("tr-TR");
}

/** Firma baş harfli kabartma yuvarlak (renk firma kimliğinden, sabit). */
export default function FirmaAvatar({ id, ad, buyuk = false }: { id: number; ad: string; buyuk?: boolean }) {
  return (
    <span
      className={`ks-avatar bg-gradient-to-br ${TONLAR[Math.abs(id) % TONLAR.length]} ${buyuk ? "!h-16 !w-16 !text-[1.35rem]" : ""}`}
      aria-hidden
    >
      {basHarfler(ad)}
    </span>
  );
}
