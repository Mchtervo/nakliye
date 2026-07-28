"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const GUN_SECENEKLERI = [2, 3, 4, 5, 6, 7] as const;

/** /plan arama formu — URL'ye yazar, sunucu planını hemen yeniler. */
export default function PlanForm({
  baslangic,
  gun,
}: {
  baslangic: string;
  gun: number;
}) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [from, setFrom] = useState(baslangic);
  const [gunSayisi, setGunSayisi] = useState(String(gun));

  useEffect(() => {
    setFrom(baslangic);
    setGunSayisi(String(gun));
  }, [baslangic, gun]);

  function planla(e?: React.FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    const n = from.trim();
    const gHam = Number(gunSayisi);
    const g =
      Number.isFinite(gHam) && gHam >= 2 && gHam <= 7 ? Math.round(gHam) : 3;
    if (n) p.set("nerede", n);
    p.set("gun", String(g));
    setGunSayisi(String(g));
    baslat(() => {
      router.push(`/plan?${p.toString()}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={planla}
      className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/4 p-3 sm:grid-cols-[1fr_auto_auto]"
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
          disabled={bekliyor}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-fog">
          Gün
        </span>
        <select
          value={gunSayisi}
          onChange={(e) => setGunSayisi(e.target.value)}
          disabled={bekliyor}
          className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-paper focus:border-amber/40 focus:outline-none sm:w-24"
        >
          {GUN_SECENEKLERI.map((g) => (
            <option key={g} value={g}>
              {g} gün
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={bekliyor}
          className="w-full rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-asphalt hover:brightness-110 disabled:opacity-60"
        >
          {bekliyor ? "Planlanıyor…" : "Planla"}
        </button>
      </div>
    </form>
  );
}
