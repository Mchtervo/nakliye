"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** /plan arama formu — URL'ye yazar. */
export default function PlanForm({
  baslangic,
  gun,
}: {
  baslangic: string;
  gun: number;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(baslangic);
  const [gunSayisi, setGunSayisi] = useState(String(gun));

  function gonder(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    const n = from.trim();
    const g = gunSayisi.trim() || "3";
    if (n) p.set("nerede", n);
    p.set("gun", g);
    router.push(`/plan?${p.toString()}`);
  }

  return (
    <form
      onSubmit={gonder}
      className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[1fr_auto_auto]"
    >
      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-fog">
          Neredeyim
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
          Gün
        </span>
        <input
          value={gunSayisi}
          onChange={(e) => setGunSayisi(e.target.value)}
          inputMode="numeric"
          className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-paper focus:border-amber/40 focus:outline-none sm:w-20"
        />
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          className="w-full rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-asphalt hover:brightness-110"
        >
          Planla
        </button>
      </div>
    </form>
  );
}
