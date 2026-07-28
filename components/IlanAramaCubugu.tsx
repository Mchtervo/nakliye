"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export type RotaCip = {
  etiket: string;
  nereden: string;
  nereye: string;
};

function gezinmeBaslat() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gezinme-basla"));
  }
}

/** NEREDEN / NEREYE arama — URL'ye yazar (GET). */
export default function IlanAramaCubugu({
  sekme,
  nereden,
  nereye,
  cipler,
}: {
  sekme: string;
  nereden: string;
  nereye: string;
  cipler: RotaCip[];
}) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [from, setFrom] = useState(nereden);
  const [to, setTo] = useState(nereye);

  useEffect(() => {
    setFrom(nereden);
    setTo(nereye);
  }, [nereden, nereye]);

  function ara(e?: React.FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    p.set("sekme", sekme);
    const n = from.trim();
    const v = to.trim();
    if (n) p.set("nereden", n);
    if (v) p.set("nereye", v);
    gezinmeBaslat();
    baslat(() => {
      router.push(`/ai/yukler?${p.toString()}`);
    });
  }

  function temizle() {
    setFrom("");
    setTo("");
    gezinmeBaslat();
    baslat(() => {
      router.push(`/ai/yukler?sekme=${encodeURIComponent(sekme)}`);
    });
  }

  const filtreVar = Boolean(nereden || nereye);

  return (
    <div className="relative space-y-2 cam p-3">
      {bekliyor && (
        <div
          role="status"
          className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#0c1017]/75 backdrop-blur-[2px]"
        >
          <p className="rounded-xl border border-amber/40 bg-amber/15 px-4 py-2.5 text-sm font-bold text-amber">
            Yük aranıyor…
          </p>
        </div>
      )}

      <form
        onSubmit={ara}
        className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-paper/75">
            Nereden
          </span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Ankara, Ostim…"
            disabled={bekliyor}
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-paper placeholder:text-paper/45 focus:border-amber/40 focus:outline-none disabled:opacity-60"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-paper/75">
            Nereye
          </span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Bolu, Gerede…"
            disabled={bekliyor}
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-paper placeholder:text-paper/45 focus:border-amber/40 focus:outline-none disabled:opacity-60"
            autoComplete="off"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={bekliyor}
            className="flex-1 rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-asphalt hover:brightness-110 disabled:opacity-70 sm:flex-none sm:min-w-[7.5rem]"
          >
            {bekliyor ? "Aranıyor…" : "Ara"}
          </button>
          {filtreVar && (
            <button
              type="button"
              disabled={bekliyor}
              onClick={temizle}
              className="rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold text-paper/80 hover:text-paper disabled:opacity-60"
            >
              Temizle
            </button>
          )}
        </div>
      </form>

      {cipler.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {cipler.map((c) => {
            const aktif =
              nereden.toLocaleLowerCase("tr-TR") ===
                c.nereden.toLocaleLowerCase("tr-TR") &&
              nereye.toLocaleLowerCase("tr-TR") ===
                c.nereye.toLocaleLowerCase("tr-TR");
            const p = new URLSearchParams();
            p.set("sekme", sekme);
            p.set("nereden", c.nereden);
            p.set("nereye", c.nereye);
            return (
              <Link
                key={c.etiket}
                href={`/ai/yukler?${p.toString()}`}
                onClick={gezinmeBaslat}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  aktif
                    ? "border-amber/50 bg-amber/15 text-amber"
                    : "border-white/12 text-paper/75 hover:border-white/25 hover:text-paper"
                }`}
              >
                {c.etiket}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
