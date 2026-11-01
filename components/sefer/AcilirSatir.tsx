"use client";

import { AnimatePresence, m } from "motion/react";
import { useState, type ReactNode } from "react";

/** İşlem satırı + sağda ⌄; basınca altta ek işlemler yumuşakça açılır. */
export default function AcilirSatir({ satir, icerik }: { satir: ReactNode; icerik: ReactNode }) {
  const [acik, setAcik] = useState(false);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        {satir}
        <button
          type="button"
          onClick={() => setAcik((v) => !v)}
          aria-expanded={acik}
          aria-label={acik ? "Diğer işlemleri gizle" : "Diğer işlemler"}
          className="sf-daha-ok"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform duration-200 ${acik ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {acik && (
          <m.div
            key="ek"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5">{icerik}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
