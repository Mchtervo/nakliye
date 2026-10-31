"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Alttan kayan pencere (telefonda) / ortada kart (geniş ekranda).
 * body'ye portal: üst bardaki backdrop-filter içine hapsolmasın.
 */
export default function AltPencere({
  baslik,
  kapat,
  children,
}: {
  baslik: string;
  kapat: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tus = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    window.addEventListener("keydown", tus);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", tus);
    };
  }, [kapat]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={baslik}>
      <button type="button" aria-label="Kapat" onClick={kapat} className="pencere-perde absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className="pencere-gir relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-[#1c1c1e] p-5 shadow-2xl sm:rounded-[1.75rem]"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-paper">{baslik}</h2>
          <button
            type="button"
            onClick={kapat}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-paper"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
