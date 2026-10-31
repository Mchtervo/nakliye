"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { veresiyeOdemeYap } from "@/app/actions";
import AltPencere from "@/components/hareket/AltPencere";
import SayanTl from "@/components/hareket/SayanSayi";

export type VeresiyeGorunum = {
  yer: string;
  alinan: number;
  odenen: number;
  kalan: number;
  hareketler: { anahtar: string; href?: string; tarihIso: string; ad: string; tutar: number; odeme: boolean }[];
};

const tarihBicim = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const kurusTl = (k: number) => (k / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

function OdemePenceresi({ yer, kapat }: { yer: VeresiyeGorunum; kapat: () => void }) {
  const router = useRouter();
  const [tutar, setTutar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bitti, setBitti] = useState(false);
  const [bekliyor, baslat] = useTransition();

  function ode() {
    setHata(null);
    baslat(async () => {
      const r = await veresiyeOdemeYap(yer.yer, tutar);
      if (r.hata) return setHata(r.hata);
      setBitti(true);
      router.refresh();
      setTimeout(kapat, 1100);
    });
  }

  if (bitti) {
    return (
      <AltPencere baslik="Ödeme yazıldı" kapat={kapat}>
        <div className="flex flex-col items-center gap-3 py-6">
          <svg viewBox="0 0 52 52" className="h-16 w-16">
            <circle cx="26" cy="26" r="24" fill="rgba(48,209,88,0.15)" />
            <path className="onay-cizgi" d="M15 27l7 7 15-15" fill="none" stroke="#30d158" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-fog">Veresiye borcu düştü.</p>
        </div>
      </AltPencere>
    );
  }

  return (
    <AltPencere baslik={`${yer.yer} · ödeme`} kapat={kapat}>
      <p className="text-sm text-fog">
        Kalan veresiye <b className="text-paper">{kurusTl(yer.kalan)} TL</b>
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
            { ad: "Tamamı", k: yer.kalan },
            { ad: "Yarısı", k: Math.round(yer.kalan / 2) },
          ].map((s) => (
            <button
              key={s.ad}
              type="button"
              disabled={yer.kalan <= 0}
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
          {bekliyor ? "Kaydediliyor…" : "Ödemeyi yaz"}
        </button>
      </form>
    </AltPencere>
  );
}

export default function VeresiyeDefteri({ yerler }: { yerler: VeresiyeGorunum[] }) {
  const [odeme, setOdeme] = useState<VeresiyeGorunum | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const kapat = useCallback(() => setOdeme(null), []);
  const toplam = yerler.reduce((t, y) => t + y.kalan, 0);

  return (
    <div className="space-y-4">
      <section className="kart p-4 sm:p-5 reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">Toplam veresiye borcu</p>
        <p className={`mt-1 font-display text-[2.4rem] font-extrabold leading-none ${toplam > 0 ? "text-paper" : "text-teal"}`}>
          <SayanTl kurus={toplam} sureMs={1100} />
        </p>
        <p className="mt-1.5 text-xs text-fog">
          {yerler.length === 0
            ? "Gider girerken “Veresiye alındı” seç; burada istasyon istasyon toplanır."
            : `${yerler.filter((y) => y.kalan > 0).length} yere borç var`}
        </p>
        <Link href="/giderler/yeni" className="btn btn-ghost mt-3 !min-h-9 text-sm">
          + Veresiye yakıt yaz
        </Link>
      </section>

      {yerler.map((y, i) => {
        const oran = y.alinan > 0 ? Math.min(1, y.odenen / y.alinan) : 1;
        const gorunen = acik === y.yer ? y.hareketler : y.hareketler.slice(0, 3);
        return (
          <section key={y.yer} className="kart cuzdan-kart space-y-3 p-4 sm:p-5" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold">{y.yer}</p>
                <p className="text-xs text-fog">
                  Alınan {kurusTl(y.alinan)} ₺ · ödenen {kurusTl(y.odenen)} ₺
                </p>
              </div>
              <p className={`shrink-0 font-display text-xl font-bold tabular-nums ${y.kalan > 0 ? "text-amber" : "text-teal"}`}>
                {y.kalan > 0 ? <SayanTl kurus={y.kalan} /> : "Borç yok"}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="akan-cubuk h-full rounded-full bg-teal" style={{ width: `${Math.round(oran * 100)}%` }} />
            </div>

            <ul className="space-y-1">
              {gorunen.map((h) => {
                const satir = (
                  <>
                    <span className="min-w-0 flex-1 truncate text-paper/85">
                      {tarihBicim.format(new Date(h.tarihIso))} · {h.ad}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${h.odeme ? "text-teal" : "text-paper"}`}>
                      {h.odeme ? "−" : "+"}
                      {kurusTl(h.tutar)} ₺
                    </span>
                  </>
                );
                return (
                  <li key={h.anahtar}>
                    {h.href ? (
                      <Link href={h.href} className="dokun -mx-2 flex gap-2 rounded-lg px-2 py-1.5 text-sm">
                        {satir}
                      </Link>
                    ) : (
                      <div className="-mx-2 flex gap-2 px-2 py-1.5 text-sm">{satir}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {y.hareketler.length > 3 && (
              <button
                type="button"
                onClick={() => setAcik(acik === y.yer ? null : y.yer)}
                className="text-sm font-semibold text-amber"
              >
                {acik === y.yer ? "Daha az" : `Tümü (${y.hareketler.length})`}
              </button>
            )}

            <button
              type="button"
              onClick={() => setOdeme(y)}
              disabled={y.kalan <= 0}
              className="btn btn-amber w-full !min-h-10 text-sm disabled:opacity-40"
            >
              Ödeme yap
            </button>
          </section>
        );
      })}

      {odeme && <OdemePenceresi yer={odeme} kapat={kapat} />}
    </div>
  );
}
