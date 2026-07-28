"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Link tıklanınca hemen çubuk; sayfa gelince kapanır.
 * Donma hissini azaltır (asıl hız için sayfa sorguları da hafifletildi).
 */
export default function GezinmeIlerleme() {
  const pathname = usePathname();
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    function tiklama(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.("a[href]");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) {
        return;
      }
      if (/^(https?:|\/\/)/i.test(href)) return;
      // Aynı sayfa
      const yol = href.split("?")[0];
      if (yol === pathname) return;
      setGorunur(true);
    }
    document.addEventListener("click", tiklama, true);
    return () => document.removeEventListener("click", tiklama, true);
  }, [pathname]);

  useEffect(() => {
    setGorunur(false);
  }, [pathname]);

  // Takılı kalmasın
  useEffect(() => {
    if (!gorunur) return;
    const t = window.setTimeout(() => setGorunur(false), 8000);
    return () => window.clearTimeout(t);
  }, [gorunur]);

  if (!gorunur) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-white/5"
      aria-hidden
    >
      <div className="gezinme-bar h-full bg-amber shadow-[0_0_12px_rgba(240,160,32,0.85)]" />
    </div>
  );
}
