"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Buton = { etiket: string; url: string };
type Bildirim = {
  id: number;
  baslik: string;
  metin: string;
  url: string | null;
  butonlar: Buton[];
  okundu: boolean;
  zaman: string;
};

const YENILE_MS = 60 * 1000;

function gecen(iso: string): string {
  const dk = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (dk < 1) return "şimdi";
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa`;
  return `${Math.round(sa / 24)} gün`;
}

async function okundu(id?: number): Promise<void> {
  await fetch("/api/bildirimler", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id } : {}),
  }).catch(() => null);
}

/** Üst barda zil + okunmamış sayısı; dokununca sayfadan çıkmadan pencere açılır. */
export default function BildirimZili() {
  const router = useRouter();
  const [liste, setListe] = useState<Bildirim[]>([]);
  const [okunmamis, setOkunmamis] = useState(0);
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState<Bildirim | null>(null);

  const yukle = useCallback(async () => {
    try {
      const r = await fetch("/api/bildirimler", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { liste: Bildirim[]; okunmamis: number };
      setListe(j.liste);
      setOkunmamis(j.okunmamis);
    } catch {
      /* çevrimdışı */
    }
  }, []);

  useEffect(() => {
    const ilk = setTimeout(() => void yukle(), 0);
    const zamanlayici = setInterval(() => {
      if (document.visibilityState === "visible") void yukle();
    }, YENILE_MS);
    const gorunur = () => document.visibilityState === "visible" && void yukle();
    document.addEventListener("visibilitychange", gorunur);
    return () => {
      clearTimeout(ilk);
      clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", gorunur);
    };
  }, [yukle]);

  // Pencere açıkken arka sayfa kaymasın
  useEffect(() => {
    if (!acik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = onceki;
    };
  }, [acik]);

  function okunduIsaretle(b: Bildirim) {
    if (b.okundu) return;
    setListe((l) => l.map((x) => (x.id === b.id ? { ...x, okundu: true } : x)));
    setOkunmamis((n) => Math.max(0, n - 1));
    void okundu(b.id);
  }

  function ac(b: Bildirim) {
    setSecili(b);
    okunduIsaretle(b);
  }

  function kapat() {
    setAcik(false);
    setSecili(null);
  }

  function hepsiOkundu() {
    setListe((l) => l.map((x) => ({ ...x, okundu: true })));
    setOkunmamis(0);
    void okundu();
  }

  function git(url: string) {
    kapat();
    if (url.startsWith("/")) router.push(url);
    else window.location.assign(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="dokun relative flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-paper"
        aria-label={okunmamis > 0 ? `${okunmamis} okunmamış bildirim` : "Bildirimler"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {okunmamis > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ember px-1 text-[11px] font-bold leading-none text-white">
            {okunmamis > 99 ? "99+" : okunmamis}
          </span>
        )}
      </button>

      {acik && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Bildirimler">
          <button type="button" aria-label="Kapat" onClick={kapat} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div
            className="relative flex max-h-[82vh] w-full max-w-md flex-col rounded-t-[1.6rem] bg-[#1c1c1e] shadow-2xl sm:rounded-[1.6rem]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
              {secili ? (
                <button type="button" onClick={() => setSecili(null)} className="text-[15px] font-semibold text-amber">
                  ‹ Bildirimler
                </button>
              ) : (
                <p className="text-[17px] font-semibold text-paper">Bildirimler</p>
              )}
              <div className="flex items-center gap-3">
                {!secili && okunmamis > 0 && (
                  <button type="button" onClick={hepsiOkundu} className="text-sm font-semibold text-fog hover:text-paper">
                    Tümü okundu
                  </button>
                )}
                <button
                  type="button"
                  onClick={kapat}
                  aria-label="Kapat"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-paper"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto">
              {secili ? (
                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-xs text-fog">{gecen(secili.zaman)} önce</p>
                    <h2 className="mt-1 font-display text-xl font-bold text-paper">{secili.baslik}</h2>
                  </div>
                  <p className="whitespace-pre-line text-[15px] leading-relaxed text-paper/90">{secili.metin}</p>
                  <div className="space-y-2">
                    {secili.butonlar.map((b, i) => (
                      <button
                        key={b.url + b.etiket}
                        type="button"
                        onClick={() => git(b.url)}
                        className={`btn w-full ${i === 0 ? "btn-amber" : "btn-ghost"}`}
                      >
                        {b.etiket}
                      </button>
                    ))}
                    <button type="button" onClick={kapat} className="btn btn-ghost w-full">
                      Kapat
                    </button>
                  </div>
                </div>
              ) : liste.length === 0 ? (
                <p className="p-8 text-center text-sm text-fog">Henüz bildirim yok.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {liste.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => ac(b)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-white/[0.05]"
                      >
                        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${b.okundu ? "bg-transparent" : "bg-amber"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={`truncate text-[15px] ${b.okundu ? "text-paper/70" : "font-semibold text-paper"}`}>
                              {b.baslik}
                            </span>
                            <span className="shrink-0 text-xs text-fog">{gecen(b.zaman)}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-sm text-fog">{b.metin}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
