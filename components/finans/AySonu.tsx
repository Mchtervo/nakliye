"use client";

import { useState } from "react";
import SayanTl from "@/components/hareket/SayanSayi";

export type AyNetGorunum = {
  anahtar: string;
  etiket: string;
  gelir: number;
  yakit: number;
  kredi: number;
  kart: number;
  diger: number;
  net: number;
};

/** Geçen aya göre değişim; geçen ay ≤0 ise oran anlamsız → null. */
function degisim(simdi: number, onceki: number | undefined): number | null {
  if (onceki === undefined || onceki <= 0) return null;
  return Math.round(((simdi - onceki) / onceki) * 100);
}

export default function AySonu({ aylar }: { aylar: AyNetGorunum[] }) {
  const [secili, setSecili] = useState(aylar.length - 1);
  const ay = aylar[secili];
  const onceki = aylar[secili - 1];
  const yuzde = degisim(ay.net, onceki?.net);
  const enBuyuk = Math.max(1, ...aylar.map((a) => Math.abs(a.net)));
  const buAy = secili === aylar.length - 1;

  const kalemler = [
    { ad: "Kazanç (seferler)", tutar: ay.gelir, renk: "bg-teal", arti: true },
    { ad: "Yakıt", tutar: ay.yakit, renk: "bg-amber" },
    { ad: "Kredi taksitleri", tutar: ay.kredi, renk: "bg-[#bf5af2]" },
    { ad: "Kredi kartı ödemeleri", tutar: ay.kart, renk: "bg-[#0a84ff]" },
    { ad: "Diğer giderler", tutar: ay.diger, renk: "bg-white/40" },
  ];
  const olcek = Math.max(1, ay.gelir, ...kalemler.map((k) => k.tutar));

  return (
    <section id="ay-sonu" className="kart space-y-4 overflow-hidden p-4 sm:p-5 reveal">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">
          {buAy ? "Bu ay net kalan" : `${ay.etiket} net kalan`}
        </p>
        <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className={`font-display text-[2.4rem] font-extrabold leading-none ${ay.net < 0 ? "text-ember" : "text-paper"}`}>
            <SayanTl kurus={ay.net} sureMs={1200} />
          </p>
          {yuzde !== null && (
            <span
              key={ay.anahtar}
              className={`satir-akar mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold ${
                yuzde >= 0 ? "bg-teal/15 text-teal" : "bg-ember/15 text-ember"
              }`}
              style={{ animationDelay: "0.5s" }}
            >
              <svg viewBox="0 0 12 12" className={`h-3 w-3 ${yuzde >= 0 ? "" : "rotate-180"}`} fill="currentColor">
                <path d="M6 1l5 6H7.5v4h-3V7H1z" />
              </svg>
              %{Math.abs(yuzde)} {yuzde >= 0 ? "daha kârlı" : "daha az"}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs text-fog">
          {onceki
            ? `${onceki.etiket}: ${(onceki.net / 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`
            : "Kazanç − yakıt − kredi − kart − diğer giderler"}
          {" · KDV dahil, demirbaş hariç"}
        </p>
      </div>

      {/* Döküm: kalemler sırayla akar, çubuklar kazanca oranla dolar */}
      <ul key={ay.anahtar} className="space-y-2.5">
        {kalemler.map((k, i) => (
          <li key={k.ad} className="satir-akar" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-paper/85">{k.ad}</span>
              <span className={`font-semibold tabular-nums ${k.arti ? "text-teal" : k.tutar > 0 ? "text-paper" : "text-fog"}`}>
                {k.arti ? "+" : k.tutar > 0 ? "−" : ""}
                {(k.tutar / 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className={`bar-anim h-full rounded-full ${k.renk}`}
                style={{ width: `${(k.tutar / olcek) * 100}%`, animationDelay: `${200 + i * 70}ms` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Son aylar: dokun → o ayın dökümü */}
      <div>
        <div className="flex h-24 items-end gap-2">
          {aylar.map((a, i) => {
            const h = Math.max(6, (Math.abs(a.net) / enBuyuk) * 100);
            const aktif = i === secili;
            return (
              <button
                key={a.anahtar}
                type="button"
                onClick={() => setSecili(i)}
                aria-label={`${a.etiket} net`}
                aria-pressed={aktif}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span
                  className={`w-full origin-bottom rounded-t-lg transition-all duration-500 ${
                    a.net < 0 ? "bg-ember" : "bg-teal"
                  } ${aktif ? "opacity-100" : "opacity-35"}`}
                  style={{
                    height: `${h}%`,
                    animation: `grafik-cubuk 0.8s var(--yay) ${i * 60}ms both`,
                    transitionTimingFunction: "var(--yay)",
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-2">
          {aylar.map((a, i) => (
            <span key={a.anahtar} className={`flex-1 truncate text-center text-[11px] ${i === secili ? "font-bold text-paper" : "text-fog"}`}>
              {a.etiket.slice(0, 3)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
