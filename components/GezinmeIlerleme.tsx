"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";

/** Sayfa değişiminde üstte ince ilerleme çubuğu — donma hissini azaltır. */
export default function GezinmeIlerleme() {
  const pathname = usePathname();
  const [gorunur, setGorunur] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setGorunur(true);
    const t1 = window.setTimeout(() => setGorunur(false), 450);
    return () => window.clearTimeout(t1);
  }, [pathname]);

  // İlk boyamada da kısa göster
  useEffect(() => {
    startTransition(() => {});
  }, [startTransition]);

  if (!gorunur) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent"
      aria-hidden
    >
      <div className="gezinme-bar h-full w-full bg-amber shadow-[0_0_12px_rgba(240,160,32,0.85)]" />
    </div>
  );
}
