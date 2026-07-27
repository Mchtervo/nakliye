"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type RotaCip = {
  etiket: string;
  nereden: string;
  nereye: string;
};

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
  const [from, setFrom] = useState(nereden);
  const [to, setTo] = useState(nereye);

  function ara(e?: React.FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    p.set("sekme", sekme);
    const n = from.trim();
    const v = to.trim();
    if (n) p.set("nereden", n);
    if (v) p.set("nereye", v);
    router.push(`/ai/yukler?${p.toString()}`);
  }

  function temizle() {
    setFrom("");
    setTo("");
    router.push(`/ai/yukler?sekme=${encodeURIComponent(sekme)}`);
  }

  const filtreVar = Boolean(nereden || nereye);

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <form onSubmit={ara} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-fog">
            Nereden
          </span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Ankara, Ostim…"
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-paper placeholder:text-fog/60 focus:border-amber/40 focus:outline-none"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-fog">
            Nereye
          </span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Bolu, Gerede…"
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-paper placeholder:text-fog/60 focus:border-amber/40 focus:outline-none"
            autoComplete="off"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-asphalt hover:brightness-110 sm:flex-none"
          >
            Ara
          </button>
          {filtreVar && (
            <button
              type="button"
              onClick={temizle}
              className="rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold text-fog hover:text-paper"
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
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  aktif
                    ? "border-amber/50 bg-amber/15 text-amber"
                    : "border-white/12 text-fog hover:border-white/25 hover:text-paper"
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
