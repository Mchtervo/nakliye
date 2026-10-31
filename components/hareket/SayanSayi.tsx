"use client";

import { useEffect, useRef, useState } from "react";

const tlBicim = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

/** Apple tarzı yavaşlayan eğri (hızlı başlar, yumuşak oturur). */
function yay(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Değer değişince eskisinden yenisine sayar (ödeme yapınca borç akarak düşer).
 * Hareket azaltma açıksa doğrudan yazar.
 */
export function useSayan(hedef: number, sureMs = 900): number {
  const [deger, setDeger] = useState(0);
  const onceki = useRef(0);

  useEffect(() => {
    const bas = onceki.current;
    onceki.current = hedef;
    const azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (azalt || bas === hedef) {
      const t = setTimeout(() => setDeger(hedef), 0);
      return () => clearTimeout(t);
    }
    let kare = 0;
    const baslangic = performance.now();
    const adim = (simdi: number) => {
      const t = Math.min(1, (simdi - baslangic) / sureMs);
      setDeger(bas + (hedef - bas) * yay(t));
      if (t < 1) kare = requestAnimationFrame(adim);
    };
    kare = requestAnimationFrame(adim);
    return () => cancelAnimationFrame(kare);
  }, [hedef, sureMs]);

  return deger;
}

/** Kuruş → sayan TL ("₺12.450"). */
export default function SayanTl({
  kurus,
  className = "",
  isaretli = false,
  sureMs,
}: {
  kurus: number;
  className?: string;
  /** + / − işareti göster */
  isaretli?: boolean;
  sureMs?: number;
}) {
  const d = useSayan(kurus / 100, sureMs);
  const yazi = tlBicim.format(Math.round(Math.abs(d)));
  const isaret = isaretli ? (kurus > 0 ? "+" : kurus < 0 ? "−" : "") : kurus < 0 ? "−" : "";
  return (
    <span className={`tabular-nums ${className}`}>
      {isaret}
      {yazi}
    </span>
  );
}
