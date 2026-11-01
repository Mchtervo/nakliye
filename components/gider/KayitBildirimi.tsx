"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Kayıt sunucuda gerçekten bitip listeye dönülünce (?kayit=1) kısa başarı
 * bildirimi; adres temizlenir ki yenileyince tekrar çıkmasın.
 */
export default function KayitBildirimi({ metin }: { metin: string }) {
  const [gorunur, setGorunur] = useState(true);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("kayit");
    window.history.replaceState(null, "", url.pathname + (url.search || ""));
    const t = window.setTimeout(() => setGorunur(false), 2600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {gorunur && (
        <m.div
          role="status"
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 500, damping: 36 }}
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[80] mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-bold text-[#15803d] shadow-[0_16px_36px_-14px_rgba(10,18,80,0.5)]"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16a34a] text-[13px] text-white" aria-hidden>
            ✓
          </span>
          {metin}
        </m.div>
      )}
    </AnimatePresence>
  );
}
