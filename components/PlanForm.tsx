"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

  const [oncekiProp, setOncekiProp] = useState({ baslangic, gun });
  if (oncekiProp.baslangic !== baslangic || oncekiProp.gun !== gun) {
    setOncekiProp({ baslangic, gun });
    setFrom(baslangic);
    setGunSayisi(String(gun));
  }

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
    <form onSubmit={planla} className="yuk-tepsi ana-gir" style={{ animationDelay: "80ms" }}>
      <div className="flex items-stretch gap-2">
        <label className="yuk-alan !flex-[1.4]">
          <svg viewBox="0 0 24 30" className="h-6 w-5 shrink-0" aria-hidden>
            <path d="M12 1C6 1 1.5 5.5 1.5 11.2 1.5 19 12 29 12 29s10.5-10 10.5-17.8C22.5 5.5 18 1 12 1z" fill="#4f6bff" />
            <circle cx="12" cy="11" r="4" fill="#fff" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="yuk-alan-etiket">Başlangıç</span>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Ankara, Ostim…"
              className="yuk-alan-girdi"
              autoComplete="off"
              disabled={bekliyor}
            />
          </span>
        </label>
        <label className="yuk-alan">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 shrink-0" aria-hidden>
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="yuk-alan-etiket">Süre</span>
            <select
              value={gunSayisi}
              onChange={(e) => setGunSayisi(e.target.value)}
              disabled={bekliyor}
              className="yuk-alan-girdi sf-secim"
            >
              {GUN_SECENEKLERI.map((g) => (
                <option key={g} value={g}>
                  {g} gün
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme mt-3 w-full !min-h-12 gap-2 !text-[15px] disabled:opacity-60">
        <span aria-hidden>✦</span>
        {bekliyor ? "Planlanıyor…" : "Plan oluştur"}
      </button>
    </form>
  );
}
