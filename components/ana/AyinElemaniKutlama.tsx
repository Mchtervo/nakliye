"use client";

import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SoforAvatar from "@/components/arac/SoforAvatar";
import { useSayan } from "@/components/hareket/SayanSayi";

export type AyinElemaniVeri = {
  ay: string;
  ayAdi: string;
  ad: string;
  plaka: string | null;
  foto: string | null;
  kar: number;
  ciro: number;
  sefer: number;
  rozet: boolean;
};

const GORULDU = "ayin-elemani-goruldu";
const SURE_MS = 10_000;
const YAY = [0.32, 0.72, 0, 1] as const;
const tl = (kurus: number) => `₺${Math.round(kurus / 100).toLocaleString("tr-TR")}`;

/** Havai fişek: tuval üstünde roket + patlama parçacıkları. */
function HavaiFisek() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const tuval = ref.current;
    const c = tuval?.getContext("2d");
    if (!tuval || !c) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const oran = Math.min(window.devicePixelRatio || 1, 2);
    let en = 0;
    let boy = 0;
    const boyutla = () => {
      en = window.innerWidth;
      boy = window.innerHeight;
      tuval.width = en * oran;
      tuval.height = boy * oran;
      c.setTransform(oran, 0, 0, oran, 0, 0);
    };
    boyutla();
    window.addEventListener("resize", boyutla);

    type Roket = { x: number; y: number; hy: number; hiz: number; renk: number };
    type Parca = { x: number; y: number; vx: number; vy: number; omur: number; yas: number; renk: number; boyut: number };
    const roketler: Roket[] = [];
    const parcalar: Parca[] = [];
    const RENKLER = [45, 28, 330, 200, 265, 150, 0];
    const at = () =>
      roketler.push({
        x: en * (0.12 + Math.random() * 0.76),
        y: boy + 10,
        hy: boy * (0.12 + Math.random() * 0.38),
        hiz: 9 + Math.random() * 4,
        renk: RENKLER[Math.floor(Math.random() * RENKLER.length)],
      });
    const patlat = (r: Roket) => {
      const adet = 46 + Math.floor(Math.random() * 26);
      for (let i = 0; i < adet; i++) {
        const aci = (Math.PI * 2 * i) / adet + Math.random() * 0.2;
        const hiz = 1.6 + Math.random() * 4.2;
        parcalar.push({
          x: r.x,
          y: r.y,
          vx: Math.cos(aci) * hiz,
          vy: Math.sin(aci) * hiz,
          omur: 55 + Math.random() * 35,
          yas: 0,
          renk: r.renk + (Math.random() * 24 - 12),
          boyut: 1.6 + Math.random() * 1.8,
        });
      }
    };

    let kare = 0;
    let sayac = 0;
    // Açılışta üçlü salvo
    at();
    setTimeout(at, 180);
    setTimeout(at, 360);
    const ciz = () => {
      kare = requestAnimationFrame(ciz);
      sayac += 1;
      if (sayac % 24 === 0) at();
      if (sayac % 90 === 0) {
        at();
        at();
      }
      // İz bırakarak sil (arka plan görünür kalsın)
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = "rgba(0,0,0,0.22)";
      c.fillRect(0, 0, en, boy);
      c.globalCompositeOperation = "lighter";
      for (let i = roketler.length - 1; i >= 0; i--) {
        const r = roketler[i];
        r.y -= r.hiz;
        c.fillStyle = `hsl(${r.renk} 100% 75%)`;
        c.beginPath();
        c.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        c.fill();
        if (r.y <= r.hy) {
          patlat(r);
          roketler.splice(i, 1);
        }
      }
      for (let i = parcalar.length - 1; i >= 0; i--) {
        const p = parcalar[i];
        p.yas += 1;
        p.vx *= 0.975;
        p.vy = p.vy * 0.975 + 0.055;
        p.x += p.vx;
        p.y += p.vy;
        const kalan = 1 - p.yas / p.omur;
        if (kalan <= 0) {
          parcalar.splice(i, 1);
          continue;
        }
        c.fillStyle = `hsl(${p.renk} 100% ${55 + kalan * 25}% / ${kalan})`;
        c.beginPath();
        c.arc(p.x, p.y, p.boyut * (0.5 + kalan * 0.5), 0, Math.PI * 2);
        c.fill();
      }
    };
    ciz();
    return () => {
      cancelAnimationFrame(kare);
      window.removeEventListener("resize", boyutla);
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

const YAGMUR = ["🏆", "🥇", "🎉", "⭐", "💰", "🎊", "👏", "🔥", "🏅", "✨", "🚛", "💪"];

/** Alttan yükselen ödül / kutlama simgeleri. */
function SimgeYagmuru() {
  const [ogeler] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      simge: YAGMUR[i % YAGMUR.length],
      sol: 4 + ((i * 53) % 92),
      gecikme: (i * 0.37) % 4.5,
      sure: 4.2 + ((i * 7) % 5) * 0.55,
      boyut: 22 + ((i * 11) % 4) * 7,
      salinim: i % 2 ? 26 : -26,
    }))
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {ogeler.map((o, i) => (
        <m.span
          key={i}
          className="absolute bottom-0"
          style={{ left: `${o.sol}%`, fontSize: o.boyut }}
          initial={{ y: 60, opacity: 0, rotate: 0 }}
          animate={{ y: "-108vh", opacity: [0, 1, 1, 0], x: [0, o.salinim, 0], rotate: [0, o.salinim / 2, 0] }}
          transition={{ duration: o.sure, delay: o.gecikme, repeat: Infinity, ease: "easeOut" }}
        >
          {o.simge}
        </m.span>
      ))}
    </div>
  );
}

function Rakam({ etiket, deger, para = true, gecikme }: { etiket: string; deger: number; para?: boolean; gecikme: number }) {
  const [basla, setBasla] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBasla(true), gecikme * 1000);
    return () => clearTimeout(t);
  }, [gecikme]);
  const d = useSayan(basla ? deger : 0, 1400);
  return (
    <m.div
      initial={{ opacity: 0, y: 26, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: gecikme, type: "spring", stiffness: 320, damping: 22 }}
      className="min-w-0 flex-1 rounded-2xl border border-[#fde68a]/30 bg-white/10 px-2 py-2.5 text-center backdrop-blur"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#fde68a]">{etiket}</p>
      <p className="truncate text-[1.15rem] font-extrabold tabular-nums text-white">{para ? tl(d) : Math.round(d)}</p>
    </m.div>
  );
}

function Sahne({ k, kapat }: { k: AyinElemaniVeri; kapat: () => void }) {
  const baslik = "AYIN ELEMANI";
  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label={`${k.ayAdi} ayının elemanı: ${k.ad}`}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden px-6 text-white"
      style={{ background: "radial-gradient(120% 90% at 50% 35%, #3b2a7a 0%, #1a1446 45%, #07061a 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06 }}
      transition={{ duration: 0.45 }}
      onClick={kapat}
    >
      {/* Dönen ışık huzmeleri */}
      <m.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[36%] h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 opacity-25"
        style={{ background: "repeating-conic-gradient(from 0deg, #fde68a 0deg 6deg, transparent 6deg 24deg)", maskImage: "radial-gradient(circle, #000 0%, transparent 62%)", WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 62%)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      />
      <HavaiFisek />
      <SimgeYagmuru />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <m.p
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: YAY }}
          className="rounded-full border border-[#fde68a]/40 bg-white/10 px-4 py-1 text-[12.5px] font-bold uppercase tracking-[0.18em] text-[#fde68a] backdrop-blur"
        >
          {k.ayAdi} ayı
        </m.p>

        <h2 className="mt-3 flex flex-wrap justify-center text-[2.5rem] font-black leading-none tracking-[-0.02em]" aria-label={baslik}>
          {baslik.split("").map((harf, i) => (
            <m.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, y: 40, rotateX: -90, scale: 0.4 }}
              animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.055, type: "spring", stiffness: 420, damping: 16 }}
              className="inline-block bg-gradient-to-b from-[#fff7c2] via-[#fbbf24] to-[#d97706] bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(251,191,36,0.55)]"
              style={{ whiteSpace: "pre" }}
            >
              {harf}
            </m.span>
          ))}
        </h2>

        {/* Fotoğraf: altın halka + taç */}
        <m.div
          className="relative mt-9"
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 1.05, type: "spring", stiffness: 240, damping: 13 }}
        >
          <m.span
            aria-hidden
            className="absolute -inset-4 rounded-full"
            style={{ background: "conic-gradient(from 0deg, #fde68a, #f59e0b, #fff7c2, #b45309, #fde68a)", filter: "blur(1px)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
          <m.span
            aria-hidden
            className="absolute -inset-8 rounded-full bg-[#fbbf24]/30 blur-2xl"
            animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.95, 1.1, 0.95] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="relative block rounded-full bg-[#1a1446] p-1.5">
            <SoforAvatar foto={k.foto} ad={k.ad} boyut={156} halka={false} />
          </span>
          <m.span
            aria-hidden
            className="absolute -top-12 left-1/2 text-[3.4rem] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            initial={{ y: -160, x: "-50%", opacity: 0, rotate: -30 }}
            animate={{ y: 0, x: "-50%", opacity: 1, rotate: [-30, 8, -4, 0] }}
            transition={{ delay: 1.7, type: "spring", stiffness: 260, damping: 11 }}
          >
            👑
          </m.span>
          <m.span
            aria-hidden
            className="absolute -bottom-3 -right-4 text-[3rem] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            initial={{ scale: 0, rotate: 60 }}
            animate={{ scale: [0, 1.35, 1], rotate: [60, -10, 0] }}
            transition={{ delay: 2.1, duration: 0.7, ease: YAY }}
          >
            🏆
          </m.span>
        </m.div>

        <m.p
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 2.0, type: "spring", stiffness: 300, damping: 15 }}
          className="mt-8 text-center text-[2rem] font-black leading-tight tracking-[-0.02em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
        >
          {k.ad}
        </m.p>
        {k.plaka && (
          <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }} className="mt-1 text-[14px] font-semibold text-[#c7cffd]">
            {k.plaka}
          </m.p>
        )}
        <m.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.5 }}
          className="mt-2 text-center text-[15px] font-bold text-[#fde68a]"
        >
          Tebrikler! Bu ayın yıldızı sensin 🎉
        </m.p>

        <div className="mt-6 flex w-full gap-2">
          <Rakam etiket="Kâr" deger={k.kar} gecikme={3.0} />
          <Rakam etiket="Ciro" deger={k.ciro} gecikme={3.25} />
          <Rakam etiket="Sefer" deger={k.sefer} para={false} gecikme={3.5} />
        </div>

        <m.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            kapat();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 4 }}
          className="mt-7 rounded-full bg-white/15 px-6 py-2.5 text-[14px] font-bold backdrop-blur"
        >
          Kapat
        </m.button>
      </div>

      {/* 10 sn sayacı */}
      <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10" aria-hidden>
        <m.span className="block h-full origin-left bg-gradient-to-r from-[#fde68a] to-[#f59e0b]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: SURE_MS / 1000, ease: "linear" }} />
      </span>
    </m.div>
  );
}

/**
 * Ayın elemanı: bu telefonda o ay için ilk girişte (ya da bildirimden gelince)
 * 10 sn kutlama oynar; ayın ilk haftası ana sayfada "tekrar izle" şeridi kalır.
 */
export default function AyinElemaniKutlama({ k }: { k: AyinElemaniVeri }) {
  const [tarayici, setTarayici] = useState(false);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    let goruldu = false;
    try {
      goruldu = localStorage.getItem(GORULDU) === k.ay;
    } catch {
      goruldu = false;
    }
    const zorla = new URLSearchParams(window.location.search).has("kutlama");
    const t = setTimeout(() => {
      setTarayici(true);
      if (!goruldu || zorla) setAcik(true);
    }, 500);
    return () => clearTimeout(t);
  }, [k.ay]);

  const kapat = useCallback(() => setAcik(false), []);

  useEffect(() => {
    if (!acik) return;
    try {
      localStorage.setItem(GORULDU, k.ay);
    } catch {
      /* gizli sekme: her girişte oynar */
    }
    if (new URLSearchParams(window.location.search).has("kutlama")) window.history.replaceState(null, "", window.location.pathname);
    try {
      navigator.vibrate?.([90, 50, 90, 50, 200]);
    } catch {
      /* titreşim yok */
    }
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(kapat, SURE_MS);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = onceki;
    };
  }, [acik, k.ay, kapat]);

  return (
    <>
      {k.rozet && (
        <m.button
          type="button"
          onClick={() => setAcik(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: YAY }}
          whileTap={{ scale: 0.97 }}
          className="relative mb-3 flex w-full items-center gap-3 overflow-hidden rounded-[1.3rem] px-3.5 py-3 text-left text-white shadow-[0_10px_28px_-12px_rgba(217,119,6,0.7)]"
          style={{ background: "linear-gradient(120deg, #b45309 0%, #f59e0b 45%, #fbbf24 100%)" }}
        >
          <m.span
            aria-hidden
            className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/30 blur-md"
            initial={{ left: "-40%" }}
            animate={{ left: "130%" }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
          />
          <span className="relative rounded-full bg-white/25 p-0.5">
            <SoforAvatar foto={k.foto} ad={k.ad} boyut={46} halka={false} />
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-[11.5px] font-bold uppercase tracking-wider text-[#fff7c2]">🏆 {k.ayAdi} ayının elemanı</span>
            <span className="block truncate text-[16.5px] font-extrabold">{k.ad}</span>
          </span>
          <span className="relative shrink-0 rounded-full bg-white/25 px-3 py-1.5 text-[12.5px] font-bold">İzle ▶</span>
        </m.button>
      )}
      {tarayici && createPortal(<AnimatePresence>{acik && <Sahne k={k} kapat={kapat} />}</AnimatePresence>, document.body)}
    </>
  );
}
