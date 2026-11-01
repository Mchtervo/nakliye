"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { anaYazi } from "@/components/ana/yazi";

const bosAbone = () => () => {};

function Icerik({ etiket, kapat, kilitli, children }: { etiket: string; kapat: () => void; kilitli: boolean; children: ReactNode }) {
  useEffect(() => {
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tus = (e: KeyboardEvent) => e.key === "Escape" && !kilitli && kapat();
    window.addEventListener("keydown", tus);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener("keydown", tus);
    };
  }, [kapat, kilitli]);

  return (
    <>
      <m.div
        className="vd-perde"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => !kilitli && kapat()}
        aria-hidden
      />
      <m.div
        role="dialog"
        aria-modal="true"
        aria-label={etiket}
        className={`vd-panel ana ${anaYazi.variable}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
      >
        <span className="sf-tutamac" aria-hidden />
        <button type="button" onClick={kapat} disabled={kilitli} aria-label="Kapat" className="vd-kapat">
          ×
        </button>
        {children}
      </m.div>
    </>
  );
}

/**
 * Açık tasarım alt paneli: perde + alttan yay ile açılan beyaz yüzey.
 * Kayıt sürerken (kilitli) perdeye/Esc'e basınca kapanmaz.
 */
export default function AltPanel({
  acik,
  etiket,
  kapat,
  kilitli = false,
  children,
}: {
  acik: boolean;
  etiket: string;
  kapat: () => void;
  kilitli?: boolean;
  children: ReactNode;
}) {
  const hazir = useSyncExternalStore(bosAbone, () => true, () => false);
  if (!hazir) return null;
  return createPortal(
    <AnimatePresence>
      {acik && (
        <Icerik key="panel" etiket={etiket} kapat={kapat} kilitli={kilitli}>
          {children}
        </Icerik>
      )}
    </AnimatePresence>,
    document.body
  );
}
