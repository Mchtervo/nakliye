"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";

const YAY = [0.32, 0.72, 0, 1] as const;

const binTl = (kurus: number) => Math.round(kurus / 100 / 1000);

/**
 * Dönem değişiminde kısa geçiş: sayfa `key={dönem}` ile yeniden kurulur,
 * içerik hafifçe yükselerek gelir ("hareketi azalt" açıkken yalnız solma).
 */
export function DonemGecis({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: YAY }}>
      {children}
    </m.div>
  );
}

export type SutunVeri = { anahtar: string; etiket: string; deger: number };

/** Aylık sütunlar (bin TL); son sütun vurgulu, eksi değer kırmızı. Görünür olunca dolar. */
export function AySutunlari({ veri, etiket }: { veri: SutunVeri[]; etiket: string }) {
  const enBuyuk = Math.max(1, ...veri.map((v) => Math.abs(v.deger)));
  return (
    <div className="rp-sutunlar" role="img" aria-label={`${etiket}: ${veri.map((v) => `${v.etiket} ${binTl(v.deger)} bin TL`).join(", ")}`}>
      {veri.map((v, i) => {
        const son = i === veri.length - 1;
        const eksi = v.deger < 0;
        return (
          <div key={v.anahtar} className="rp-sutun">
            <div className="rp-sutun-alan">
              <span className={`text-[12px] font-bold tabular-nums ${son ? "text-[#4f46e5]" : eksi ? "text-[#dc2626]" : "text-[var(--a-murekkep)]"}`}>{binTl(v.deger)}</span>
              <m.span
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.55, delay: 0.08 + i * 0.05, ease: YAY }}
                className={`rp-sutun-cubuk ${son ? "rp-sutun-son" : ""} ${eksi ? "rp-sutun-eksi" : ""}`}
                style={{ height: `${Math.max(5, (Math.abs(v.deger) / enBuyuk) * 82)}%` }}
              />
            </div>
            <span className={`text-[11.5px] font-semibold ${son ? "text-[#4f46e5]" : "text-[var(--a-ikincil)]"}`}>{v.etiket}</span>
          </div>
        );
      })}
    </div>
  );
}

export type CiftVeri = { anahtar: string; etiket: string; a: number; b: number };

/** Yan yana iki sütun (ör. hesaplanan / indirilecek KDV), bin TL. */
export function CiftSutunlar({ veri, adA, adB }: { veri: CiftVeri[]; adA: string; adB: string }) {
  const enBuyuk = Math.max(1, ...veri.flatMap((v) => [v.a, v.b]));
  return (
    <div className="rp-sutunlar" role="img" aria-label={veri.map((v) => `${v.etiket}: ${adA} ${binTl(v.a)}, ${adB} ${binTl(v.b)} bin TL`).join("; ")}>
      {veri.map((v, i) => (
        <div key={v.anahtar} className="rp-sutun">
          <div className="rp-sutun-alan !flex-row !items-end gap-[3px]">
            {[
              { d: v.a, s: "rp-cift-a" },
              { d: v.b, s: "rp-cift-b" },
            ].map((c, j) => (
              <span key={j} className="flex h-full w-[44%] max-w-[1.6rem] flex-col items-center justify-end">
                <span className="mb-0.5 text-[10.5px] font-bold tabular-nums text-[var(--a-murekkep)]">{binTl(c.d)}</span>
                <m.span
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.55, delay: 0.08 + i * 0.06 + j * 0.04, ease: YAY }}
                  className={`block w-full origin-bottom rounded-t-[6px] ${c.s}`}
                  style={{ height: `${Math.max(3, (c.d / enBuyuk) * 82)}%` }}
                />
              </span>
            ))}
          </div>
          <span className="text-[11.5px] font-semibold capitalize text-[var(--a-ikincil)]">{v.etiket}</span>
        </div>
      ))}
    </div>
  );
}

/** Yatay oran çubuğu: görünür olunca soldan dolar. */
export function YatayCubuk({ oran, renk, gecikme = 0 }: { oran: number; renk: string; gecikme?: number }) {
  return (
    <span className="block h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#eceef6]">
      <m.span
        className={`block h-full origin-left rounded-full ${renk}`}
        style={{ width: `${Math.max(0, Math.min(1, oran)) * 100}%` }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.5, delay: gecikme, ease: YAY }}
      />
    </span>
  );
}
