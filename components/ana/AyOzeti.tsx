"use client";

import { m } from "motion/react";
import { createContext, useContext, useState, type ReactNode } from "react";

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

type Secim = { aylar: AyNetGorunum[]; secili: number; sec: (i: number) => void };
const AySecimi = createContext<Secim | null>(null);

/** Başlıktaki grafik ile "Ayın hesabı" aynı seçili ayı gösterir. */
export function AySecimSaglayici({ aylar, children }: { aylar: AyNetGorunum[]; children: ReactNode }) {
  const [secili, sec] = useState(Math.max(0, aylar.length - 1));
  return <AySecimi.Provider value={{ aylar, secili, sec }}>{children}</AySecimi.Provider>;
}

function useAy() {
  const s = useContext(AySecimi);
  if (!s) throw new Error("AySecimSaglayici yok");
  return s;
}

const tl = (kurus: number) =>
  `${kurus < 0 ? "−" : ""}₺${Math.abs(Math.round(kurus / 100)).toLocaleString("tr-TR")}`;

/** Geçen aya göre değişim; geçen ay ≤0 ise oran anlamsız. */
function degisim(simdi: number, onceki?: number): number | null {
  if (onceki === undefined || onceki <= 0) return null;
  return Math.round(((simdi - onceki) / onceki) * 100);
}

/** Lacivert başlıktaki net kalan + 6 aylık çubuklar (bin TL). */
export function BaslikOzet() {
  const { aylar, secili, sec } = useAy();
  if (aylar.length === 0) return null;
  const ay = aylar[secili];
  const onceki = aylar[secili - 1];
  const yuzde = degisim(ay.net, onceki?.net);
  const enBuyuk = Math.max(1, ...aylar.map((a) => Math.abs(a.net)));
  const buAy = secili === aylar.length - 1;
  // Sütun: ince çubuk, ama "-202" gibi uzun etiket komşusuna binmesin
  const sutun = Math.max(19, ...aylar.map((a) => String(Math.round(a.net / 100 / 1000)).length * 6.6));

  return (
    <div className="ana-gir" style={{ animationDelay: "60ms" }}>
      <p className="text-[15px] font-semibold text-[#aab6ff]">{buAy ? "Bu ay net kalan" : `${ay.etiket} net kalan`}</p>
      <p
        key={ay.anahtar}
        className={`ana-tutar mt-1 text-[2.15rem] font-extrabold leading-none tracking-[-0.035em] ${ay.net < 0 ? "text-[#ffb4b4]" : "text-white"}`}
      >
        {tl(ay.net)}
      </p>
      <p className="mt-1.5 text-[12px] font-medium text-[#9aa6e8]">
        KDV dahil • Demirbaş hariç
        {yuzde !== null && (
          <span className={`ml-2 whitespace-nowrap font-bold ${yuzde >= 0 ? "text-[#7ef0a8]" : "text-[#ffb4b4]"}`}>
            {yuzde >= 0 ? "↑" : "↓"} %{Math.abs(yuzde)}
          </span>
        )}
      </p>

      <div className="mt-3 flex items-end gap-[7px]" role="group" aria-label="Son 6 ayın net kalanı">
        {aylar.map((a, i) => {
          const aktif = i === secili;
          const h = Math.max(8, (Math.abs(a.net) / enBuyuk) * 46);
          const bin = Math.round(a.net / 100 / 1000);
          return (
            <button
              key={a.anahtar}
              type="button"
              onClick={() => sec(i)}
              aria-pressed={aktif}
              aria-label={`${a.etiket}: ${tl(a.net)}`}
              className="relative flex flex-col items-center gap-1 after:absolute after:-inset-x-[3px] after:inset-y-0 after:content-['']"
              style={{ width: sutun }}
            >
              <span className={`text-[11px] font-bold tabular-nums ${aktif ? "text-white" : "text-[#c9d0ff]"}`}>{bin}</span>
              <m.span
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.15 + i * 0.05, ease: [0.32, 0.72, 0, 1] }}
                className={`ana-cubuk mx-auto block w-[19px] origin-bottom rounded-t-[7px] rounded-b-[2px] ${aktif ? "ana-cubuk-aktif" : ""} ${a.net < 0 ? "ana-cubuk-eksi" : ""}`}
                style={{ height: h }}
              />
              <span className={`text-[10.5px] font-semibold ${aktif ? "text-white" : "text-[#9aa6e8]"}`}>
                {a.etiket.slice(0, 3).replace(/^./, (c) => c.toLocaleUpperCase("tr-TR"))}
              </span>
            </button>
          );
        })}
        <span className="mb-5 ml-1 whitespace-nowrap text-[10.5px] font-medium text-[#8f9be0]">bin TL</span>
      </div>
    </div>
  );
}

const IKON = {
  kazanc: (
    <path d="M4 16l5-5 4 4 7-7M15 8h5v5" />
  ),
  yakit: (
    <>
      <path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M4 20h12M8 9h4" />
      <path d="M15 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3" />
    </>
  ),
  kredi: (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.5" />
      <path d="M5 6.5v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5M5 11.5v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" />
    </>
  ),
  kart: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  diger: (
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>
  ),
};

/** "Ayın hesabı": seçili ayın kazanç − gider dökümü. */
export function AyinHesabi() {
  const { aylar, secili } = useAy();
  if (aylar.length === 0) return null;
  const ay = aylar[secili];
  const satirlar = [
    { ad: "Kazanç (seferler)", tutar: ay.gelir, ikon: IKON.kazanc, ton: "ana-ton-yesil", cubuk: "bg-[#22c55e]", arti: true },
    { ad: "Yakıt", tutar: ay.yakit, ikon: IKON.yakit, ton: "ana-ton-kirmizi", cubuk: "bg-[#f87171]" },
    { ad: "Kredi taksitleri", tutar: ay.kredi, ikon: IKON.kredi, ton: "ana-ton-indigo", cubuk: "bg-[#f87171]" },
    { ad: "Kart ödemeleri", tutar: ay.kart, ikon: IKON.kart, ton: "ana-ton-turuncu", cubuk: "bg-[#f87171]" },
    { ad: "Diğer giderler", tutar: ay.diger, ikon: IKON.diger, ton: "ana-ton-gri", cubuk: "bg-[#f87171]" },
  ];
  const olcek = Math.max(1, ...satirlar.map((s) => s.tutar));

  return (
    <section className="ana-bolum ana-gir" style={{ animationDelay: "300ms" }} aria-labelledby="ayin-hesabi">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ayin-hesabi" className="ana-baslik">
          {secili === aylar.length - 1 ? "Ayın hesabı" : `${ay.etiket.replace(/^./, (c) => c.toLocaleUpperCase("tr-TR"))} hesabı`}
        </h2>
        <p className="truncate text-[11.5px] text-[var(--a-ikincil)]">Seferler − yakıt − kredi − kart − diğer</p>
      </div>
      <ul className="mt-3">
        {satirlar.map((s, i) => (
          <li key={s.ad} className="flex items-center gap-2.5 border-b border-[var(--a-cizgi)] py-1.5 last:border-0">
            <span className={`ana-mini-ikon ${s.ton}`} aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {s.ikon}
              </svg>
            </span>
            <span className="w-[7.1rem] shrink-0 truncate text-[13.5px] font-medium">{s.ad}</span>
            <span className="h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#eceef6]">
              <m.span
                className={`block h-full rounded-full ${s.cubuk}`}
                // İlk açılışta dolar; ay değişince sıfırdan değil, olduğu yerden kayar
                initial={{ width: 0 }}
                animate={{ width: `${(s.tutar / olcek) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.04, ease: [0.32, 0.72, 0, 1] }}
              />
            </span>
            <span
              className={`w-[5.3rem] shrink-0 text-right text-[13.5px] font-bold tabular-nums ${
                s.tutar === 0 ? "text-[var(--a-ikincil)]" : s.arti ? "text-[#16a34a]" : "text-[#ef4444]"
              }`}
            >
              {s.tutar === 0 ? "₺0" : `${s.arti ? "+" : "−"}${tl(s.tutar)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
