"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState, useTransition } from "react";
import { kartKaydet, kartOdemeYap, kartSil, type KartSonuc } from "@/app/actions";
import AltPencere from "@/components/hareket/AltPencere";
import SayanTl from "@/components/hareket/SayanSayi";

export type KartGorunum = {
  id: number;
  ad: string;
  sonOdemeGunu: number;
  borc: number;
  odenen: number;
  kalan: number;
  sonOdemeIso: string;
  kalanGun: number;
};

/** Cüzdandaki kartlar gibi; sırayla renk. */
const DEGRADELER = [
  "from-[#2b2d42] via-[#1f2937] to-[#0b0f19]",
  "from-[#ff9f0a] via-[#f26b00] to-[#a63f00]",
  "from-[#0a84ff] via-[#0060df] to-[#002f7a]",
  "from-[#30d158] via-[#1a9e44] to-[#0b5124]",
  "from-[#bf5af2] via-[#8e3fd1] to-[#4b1a7a]",
];

const tarihBicim = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" });
const kurusTl = (k: number) => (k / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

function gunYazi(g: number): { yazi: string; ton: string } {
  if (g < 0) return { yazi: `${-g} gün geçti`, ton: "bg-ember text-white" };
  if (g === 0) return { yazi: "Son gün bugün", ton: "bg-ember text-white" };
  if (g <= 3) return { yazi: `${g} gün kaldı`, ton: "bg-amber text-black" };
  return { yazi: `${g} gün`, ton: "bg-white/20 text-white" };
}

function OdemePenceresi({ kart, kapat }: { kart: KartGorunum; kapat: () => void }) {
  const router = useRouter();
  const [tutar, setTutar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bitti, setBitti] = useState(false);
  const [bekliyor, baslat] = useTransition();

  function ode() {
    setHata(null);
    baslat(async () => {
      const r = await kartOdemeYap(kart.id, tutar);
      if (r.hata) return setHata(r.hata);
      setBitti(true);
      router.refresh();
      setTimeout(kapat, 1100);
    });
  }

  if (bitti) {
    return (
      <AltPencere baslik="Ödeme kaydedildi" kapat={kapat}>
        <div className="flex flex-col items-center gap-3 py-6">
          <svg viewBox="0 0 52 52" className="h-16 w-16">
            <circle cx="26" cy="26" r="24" fill="rgba(48,209,88,0.15)" />
            <path className="onay-cizgi" d="M15 27l7 7 15-15" fill="none" stroke="#30d158" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-fog">Kalan borç güncellendi.</p>
        </div>
      </AltPencere>
    );
  }

  return (
    <AltPencere baslik={`${kart.ad} · ödeme`} kapat={kapat}>
      <p className="text-sm text-fog">
        Kalan borç <b className="text-paper">{kurusTl(kart.kalan)} TL</b>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ode();
        }}
        className="mt-4 space-y-3"
      >
        <div className="relative">
          <input
            value={tutar}
            onChange={(e) => setTutar(e.target.value)}
            inputMode="decimal"
            autoFocus
            placeholder="0"
            aria-label="Ödeme tutarı"
            className="alan !py-4 pr-12 text-center font-display text-3xl font-bold"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-fog">₺</span>
        </div>
        <div className="flex gap-2">
          {[
            { ad: "Tamamı", k: kart.kalan },
            { ad: "Yarısı", k: Math.round(kart.kalan / 2) },
          ].map((s) => (
            <button
              key={s.ad}
              type="button"
              disabled={kart.kalan <= 0}
              onClick={() => setTutar(kurusTl(s.k))}
              className="flex-1 rounded-xl bg-white/[0.08] py-2 text-sm font-semibold text-paper active:scale-95 disabled:opacity-40"
              style={{ transition: "transform 0.2s var(--yay)" }}
            >
              {s.ad}
            </button>
          ))}
        </div>
        {hata && <p className="text-sm font-semibold text-ember">{hata}</p>}
        <button type="submit" disabled={bekliyor || !tutar.trim()} className="btn btn-amber w-full !py-3 text-base disabled:opacity-50">
          {bekliyor ? "Kaydediliyor…" : "Ödemeyi kaydet"}
        </button>
      </form>
    </AltPencere>
  );
}

function KartFormPenceresi({ kart, kapat }: { kart: KartGorunum | null; kapat: () => void }) {
  const [durum, gonder, bekliyor] = useActionState<KartSonuc, FormData>(async (o, f) => {
    const r = await kartKaydet(o, f);
    if (r.tamam) setTimeout(kapat, 0);
    return r;
  }, { hata: null, tamam: false });
  const [siliniyor, setSiliniyor] = useState(false);

  return (
    <AltPencere baslik={kart ? `${kart.ad} · ekstre` : "Kredi kartı ekle"} kapat={kapat}>
      <form action={gonder} className="space-y-3">
        {kart && <input type="hidden" name="kartId" value={kart.id} />}
        <div>
          <label htmlFor="kart-ad" className="etiket">
            Kart adı
          </label>
          <input id="kart-ad" name="ad" required defaultValue={kart?.ad} placeholder="Garanti Bonus" className="alan" autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="kart-borc" className="etiket">
              Toplam borç (₺)
            </label>
            <input
              id="kart-borc"
              name="borc"
              inputMode="decimal"
              defaultValue={kart ? kurusTl(kart.borc) : ""}
              placeholder="45.000"
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="kart-gun" className="etiket">
              Son ödeme günü
            </label>
            <input
              id="kart-gun"
              name="sonOdemeGunu"
              inputMode="numeric"
              required
              defaultValue={kart?.sonOdemeGunu}
              placeholder="Ayın 15'i → 15"
              className="alan"
            />
          </div>
        </div>
        {kart && (
          <p className="text-xs text-fog">Yeni ekstre geldiyse borcu değiştir: önceki ödemeler sıfırlanır, kalan yeni borçtan hesaplanır.</p>
        )}
        {durum.hata && <p className="text-sm font-semibold text-ember">{durum.hata}</p>}
        <button type="submit" disabled={bekliyor} className="btn btn-amber w-full disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {kart && (
          <button
            type="button"
            disabled={siliniyor}
            onClick={async () => {
              if (!window.confirm(`${kart.ad} silinsin mi? Ödeme geçmişi de silinir.`)) return;
              setSiliniyor(true);
              await kartSil(kart.id);
              kapat();
            }}
            className="w-full py-2 text-sm font-semibold text-ember"
          >
            Kartı sil
          </button>
        )}
      </form>
    </AltPencere>
  );
}

export default function KrediKartlari({ kartlar }: { kartlar: KartGorunum[] }) {
  const [odeme, setOdeme] = useState<KartGorunum | null>(null);
  const [duzen, setDuzen] = useState<KartGorunum | "yeni" | null>(null);
  const odemeKapat = useCallback(() => setOdeme(null), []);
  const duzenKapat = useCallback(() => setDuzen(null), []);
  const toplam = kartlar.reduce((t, k) => t + k.kalan, 0);

  return (
    <section id="kartlar" className="kart space-y-4 p-4 sm:p-5 reveal">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">Kredi kartları</p>
          <h2 className="font-display text-xl font-bold">
            {kartlar.length === 0 ? "Kart borçlarını takip et" : <>Toplam borç <SayanTl kurus={toplam} /></>}
          </h2>
        </div>
        <button type="button" onClick={() => setDuzen("yeni")} className="shrink-0 text-sm font-semibold text-amber">
          + Kart
        </button>
      </div>

      {kartlar.length === 0 && (
        <p className="text-sm text-fog">
          Kartı ekle; son ödeme gününe 3 gün kala hatırlatayım, ödedikçe kalan borç düşsün.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2" style={{ perspective: "1000px" }}>
        {kartlar.map((k, i) => {
          const oran = k.borc > 0 ? Math.min(1, k.odenen / k.borc) : 1;
          const g = gunYazi(k.kalanGun);
          return (
            <div
              key={k.id}
              className={`cuzdan-kart relative overflow-hidden rounded-[1.4rem] bg-gradient-to-br p-4 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] ${DEGRADELER[i % DEGRADELER.length]}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span aria-hidden className="cuzdan-isik pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="relative flex items-start justify-between gap-2">
                <p className="truncate text-[15px] font-semibold">{k.ad}</p>
                {/* Çip */}
                <span aria-hidden className="h-7 w-9 shrink-0 rounded-md bg-gradient-to-br from-[#f5d77a] to-[#b8902f] opacity-90 shadow-inner" />
              </div>
              <p className="relative mt-4 text-[11px] uppercase tracking-wider text-white/60">{k.kalan > 0 ? "Kalan borç" : "Borç yok"}</p>
              <p className="relative font-display text-3xl font-bold leading-tight">
                <SayanTl kurus={k.kalan} sureMs={1100} />
              </p>
              <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="akan-cubuk h-full rounded-full bg-white" style={{ width: `${Math.round(oran * 100)}%` }} />
              </div>
              <div className="relative mt-3 flex items-center justify-between gap-2 text-xs">
                <span className="text-white/75">
                  Son ödeme {tarihBicim.format(new Date(k.sonOdemeIso))}
                </span>
                {k.kalan > 0 && <span className={`rounded-full px-2 py-0.5 font-semibold ${g.ton}`}>{g.yazi}</span>}
              </div>
              <div className="relative mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOdeme(k)}
                  disabled={k.kalan <= 0}
                  className="flex-1 rounded-xl bg-white py-2.5 text-sm font-bold text-black active:scale-95 disabled:opacity-40"
                  style={{ transition: "transform 0.2s var(--yay)" }}
                >
                  Ödeme yap
                </button>
                <button
                  type="button"
                  onClick={() => setDuzen(k)}
                  className="rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-white active:scale-95"
                  style={{ transition: "transform 0.2s var(--yay)" }}
                >
                  Yeni ekstre
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {odeme && <OdemePenceresi kart={odeme} kapat={odemeKapat} />}
      {duzen && <KartFormPenceresi kart={duzen === "yeni" ? null : duzen} kapat={duzenKapat} />}
    </section>
  );
}
