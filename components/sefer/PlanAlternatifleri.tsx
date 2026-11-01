"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import PlanKart from "@/components/sefer/PlanKart";
import { tlYazKisa } from "@/lib/para";
import type { SeferPlani } from "@/lib/seferPlan";

/** "Alternatifleri gör": ilk plandan sonraki öneriler yumuşakça açılır. */
export default function PlanAlternatifleri({ planlar }: { planlar: SeferPlani[] }) {
  const [acik, setAcik] = useState(false);
  if (planlar.length === 0) return null;
  return (
    <div>
      <button type="button" onClick={() => setAcik((v) => !v)} aria-expanded={acik} className="sf-alternatif">
        <span className="sf-alan-ikon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
        </span>
        <span className="flex-1 text-center">{acik ? "Alternatifleri gizle" : `Alternatifleri gör (${planlar.length})`}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={`h-5 w-5 transition-transform duration-200 ${acik ? "rotate-90" : ""}`} aria-hidden>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {acik && (
          <m.div
            key="alt"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-4">
              {planlar.map((p, i) => (
                <section key={i} className="sf-kart">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-[15.5px] font-extrabold">Alternatif {i + 2}</h3>
                    <span className="text-[12.5px] font-semibold text-[#16a34a]">tahmini net {tlYazKisa(Math.max(0, p.netTahmini))}</span>
                  </div>
                  <PlanKart plan={p} />
                </section>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
