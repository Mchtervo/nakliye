"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Link / Ara tıklanınca hemen çubuk; sayfa (path veya query) gelince kapanır.
 */
export default function GezinmeIlerleme() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    function tiklama(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.("a[href]");
      if (!el) return;
      const href = el.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("tel:") ||
        href.startsWith("mailto:")
      ) {
        return;
      }
      if (/^(https?:|\/\/)/i.test(href)) return;

      const [yolHam, sorguHam = ""] = href.split("?");
      const yol = yolHam || pathname;
      const hedefSorgu = sorguHam ? `?${sorguHam}` : "";
      const simdiSorgu =
        typeof window !== "undefined" ? window.location.search : "";
      if (yol === pathname && hedefSorgu === simdiSorgu) return;
      setGorunur(true);
    }

    function elleBasla() {
      setGorunur(true);
    }

    document.addEventListener("click", tiklama, true);
    window.addEventListener("gezinme-basla", elleBasla);
    return () => {
      document.removeEventListener("click", tiklama, true);
      window.removeEventListener("gezinme-basla", elleBasla);
    };
  }, [pathname]);

  useEffect(() => {
    setGorunur(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!gorunur) return;
    const t = window.setTimeout(() => setGorunur(false), 10000);
    return () => window.clearTimeout(t);
  }, [gorunur]);

  if (!gorunur) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-white/10"
      role="status"
      aria-label="Sayfa yükleniyor"
    >
      <div className="gezinme-bar h-full bg-amber shadow-[0_0_12px_rgba(240,160,32,0.85)]" />
    </div>
  );
}
