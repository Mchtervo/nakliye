"use client";

import { useMemo, useRef, useState } from "react";

export type AyVerisi = {
  etiket: string;
  /** TL (kuruş değil) */
  gelir: number;
  gider: number;
};

const G = 600;
const Y = 220;
const UST = 16;
const ALT = 10;

function kisaTl(tl: number): string {
  const m = Math.abs(tl);
  if (m >= 1_000_000) return `${(tl / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (m >= 1_000) return `${Math.round(tl / 1_000)}B`;
  return String(Math.round(tl));
}

function yuvarlakAdim(ham: number): number {
  if (ham <= 0) return 1;
  const us = 10 ** Math.floor(Math.log10(ham));
  const oran = ham / us;
  return (oran <= 1 ? 1 : oran <= 2 ? 2 : oran <= 5 ? 5 : 10) * us;
}

function tamTl(tl: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(tl);
}

/** Catmull-Rom → kübik Bézier: noktalardan geçen yumuşak eğri. */
function egri(noktalar: [number, number][]): string {
  if (noktalar.length === 0) return "";
  if (noktalar.length === 1) return `M${noktalar[0]![0]},${noktalar[0]![1]}`;
  let d = `M${noktalar[0]![0]},${noktalar[0]![1]}`;
  for (let i = 0; i < noktalar.length - 1; i++) {
    const p0 = noktalar[i - 1] ?? noktalar[i]!;
    const p1 = noktalar[i]!;
    const p2 = noktalar[i + 1]!;
    const p3 = noktalar[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const SERILER = [
  { anahtar: "gelir", ad: "Gelir", renk: "#8b7bff" },
  { anahtar: "gider", ad: "Gider", renk: "#ff6b8b" },
  { anahtar: "kar", ad: "Kâr", renk: "#5ee6a8" },
] as const;

export default function AylikGrafik({ aylar }: { aylar: AyVerisi[] }) {
  const [donem, setDonem] = useState<6 | 12>(6);
  const [secili, setSecili] = useState<number | null>(null);
  const kutu = useRef<HTMLDivElement>(null);

  const veri = useMemo(
    () => aylar.slice(-donem).map((a) => ({ ...a, kar: a.gelir - a.gider })),
    [aylar, donem]
  );

  const hamUst = Math.max(1, ...veri.flatMap((a) => [a.gelir, a.gider, a.kar]));
  const hamAlt = Math.min(0, ...veri.map((a) => a.kar));
  const adim = yuvarlakAdim((hamUst - hamAlt) / 4);
  const enBuyuk = Math.ceil(hamUst / adim) * adim;
  const enKucuk = Math.floor(hamAlt / adim) * adim;
  const aralik = enBuyuk - enKucuk || 1;
  const x = (i: number) => (veri.length <= 1 ? G / 2 : (i / (veri.length - 1)) * G);
  const y = (v: number) => UST + (1 - (v - enKucuk) / aralik) * (Y - UST - ALT);

  const yollar = SERILER.map((s) => ({
    ...s,
    d: egri(veri.map((a, i) => [x(i), y(a[s.anahtar])])),
  }));
  const gelirAlan = `${yollar[0]!.d} L${x(veri.length - 1)},${Y} L${x(0)},${Y} Z`;
  const izgara = Array.from({ length: Math.round(aralik / adim) + 1 }, (_, i) => enBuyuk - i * adim);

  const toplamGelir = veri.reduce((t, a) => t + a.gelir, 0);
  const toplamKar = veri.reduce((t, a) => t + a.kar, 0);
  const aktif = secili !== null ? veri[secili] : null;

  function sec(clientX: number) {
    const el = kutu.current;
    if (!el || veri.length === 0) return;
    const r = el.getBoundingClientRect();
    const oran = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setSecili(Math.round(oran * (veri.length - 1)));
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold">Gelir – gider</p>
          <p className="mt-1 font-display text-[2rem] font-bold leading-none tabular-nums">
            {tamTl(toplamGelir)}
          </p>
          <p className="mt-1.5 text-[13px] text-fog">
            Son {donem} ay gelir ·{" "}
            <span className={toplamKar >= 0 ? "text-ok" : "text-ember"}>
              {toplamKar >= 0 ? "+" : ""}
              {tamTl(toplamKar)} kâr
            </span>
          </p>
        </div>
        <div className="secenek-grup relative w-[9.5rem]">
          <span
            aria-hidden
            className="tab-gosterge absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-[0.5rem] bg-[#636366] shadow-[0_3px_8px_rgba(0,0,0,0.12)]"
            style={{ transform: `translateX(${donem === 6 ? 0 : 100}%)` }}
          />
          {([6, 12] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDonem(d);
                setSecili(null);
              }}
              className="secenek relative z-10 !bg-transparent !shadow-none"
              aria-pressed={donem === d}
            >
              {d} ay
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {SERILER.map((s) => (
          <span key={s.anahtar} className="flex items-center gap-1.5 text-[13px] text-fog">
            <span className="h-2 w-2 rounded-full" style={{ background: s.renk }} />
            {s.ad}
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative h-[180px] w-9 shrink-0 text-right text-[11px] tabular-nums text-white/35 sm:h-[210px]">
          {izgara.map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${(y(v) / Y) * 100}%` }}>
              {kisaTl(v)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            ref={kutu}
            className="relative h-[180px] touch-pan-y select-none sm:h-[210px]"
            onPointerMove={(e) => sec(e.clientX)}
            onPointerDown={(e) => sec(e.clientX)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setSecili(null)}
          >
            <svg key={donem} viewBox={`0 0 ${G} ${Y}`} preserveAspectRatio="none" className="grafik-svg absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="gelir-alan" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#8b7bff" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#8b7bff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {izgara.map((v) => (
                <line
                  key={v}
                  x1="0"
                  x2={G}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={v === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}
                  strokeDasharray={v === 0 ? undefined : "4 6"}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={gelirAlan} fill="url(#gelir-alan)" />
              {yollar.map((s) => (
                <path
                  key={s.anahtar}
                  d={s.d}
                  fill="none"
                  stroke={s.renk}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={s.anahtar === "kar" ? 0.85 : 1}
                />
              ))}
              {secili !== null && (
                <line x1={x(secili)} x2={x(secili)} y1={UST - 6} y2={Y} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              )}
            </svg>

            {aktif && secili !== null && (
              <>
                <span
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#8b7bff] shadow-[0_0_0_4px_rgba(139,123,255,0.25)] transition-[left,top] duration-200"
                  style={{ left: `${(x(secili) / G) * 100}%`, top: `${(y(aktif.gelir) / Y) * 100}%` }}
                />
                <div
                  className="grafik-balon pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl bg-[#8b7bff] px-2.5 py-1.5 text-center shadow-[0_8px_24px_rgba(139,123,255,0.4)] transition-[left] duration-200"
                  style={{
                    left: `clamp(3.5rem, ${(x(secili) / G) * 100}%, calc(100% - 3.5rem))`,
                    top: `calc(${(y(Math.max(aktif.gelir, aktif.gider)) / Y) * 100}% - 3.6rem)`,
                  }}
                >
                  <p className="whitespace-nowrap text-[13px] font-bold tabular-nums text-white">{tamTl(aktif.gelir)}</p>
                  <p className="whitespace-nowrap text-[10.5px] text-white/80">
                    {aktif.etiket} · gider {kisaTl(aktif.gider)}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-white/40">
            {veri.map((a, i) => (
              <span key={a.etiket + i} className={secili === i ? "font-semibold text-white" : ""}>
                {a.etiket}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
