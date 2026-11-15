"use client";

import { useState, useTransition } from "react";
import { numaraEngelKaldir } from "@/app/ai-actions";

/** Engellenen numaralar: yanlışlıkla engelleneni geri aç. */
export default function EngelliNumaralar({ numaralar, genel = false }: { numaralar: { n: string; yazi: string }[]; genel?: boolean }) {
  const [liste, setListe] = useState(numaralar);
  const [bekliyor, basla] = useTransition();
  const [hepsi, setHepsi] = useState(false);
  const gorunen = hepsi ? liste : liste.slice(0, 8);

  return (
    <div className="rp-kart px-3 py-1">
      {liste.length === 0 ? (
        <p className="py-3 text-[13.5px] text-[var(--a-ikincil)]">
          Engellenen numara yok. Yük ilanında numara sahte ya da ulaşılamıyorsa ilanı açıp &quot;Numarayı engelle&quot;ye bas.
        </p>
      ) : (
        <ul>
          {gorunen.map((x) => (
            <li key={x.n} className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-2.5 last:border-0">
              <span className="text-[16px]" aria-hidden>
                🚫
              </span>
              <span className="flex-1 text-[15px] font-bold tabular-nums">{x.yazi}</span>
              <button
                type="button"
                disabled={bekliyor}
                onClick={() =>
                  confirm(`${x.yazi} engeli kaldırılsın mı? Bu numaranın yeni yükleri ${genel ? "yine kaydedilir" : "sana yine gelir"}.`) &&
                  basla(async () => {
                    await numaraEngelKaldir(x.n);
                    setListe((l) => l.filter((y) => y.n !== x.n));
                  })
                }
                className="shrink-0 rounded-full bg-[#eef0ff] px-3.5 py-2 text-[13px] font-bold text-[#4338ca] disabled:opacity-60"
              >
                Engeli kaldır
              </button>
            </li>
          ))}
        </ul>
      )}
      {liste.length > 8 && (
        <button type="button" onClick={() => setHepsi((h) => !h)} className="w-full py-2.5 text-[13px] font-bold text-[#4338ca]">
          {hepsi ? "Daha az göster" : `Tümünü göster (${liste.length})`}
        </button>
      )}
    </div>
  );
}
