"use client";

import { useState, useTransition } from "react";
import { odemeGuncelle, odemeSil } from "@/app/odeme-actions";
import { kurustanGiris, tlGirisBicimle, tlYazKisa } from "@/lib/para";

export type OdemeOge = { id: number; tarihYazi: string; tutar: number; not: string | null };

/** Bir seferin tahsilatları: yanlış girileni düzelt ya da sil. */
export default function OdemeDuzelt({ odemeler }: { odemeler: OdemeOge[] }) {
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null);
  const [yazi, setYazi] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (odemeler.length === 0) return <p className="text-[12.5px] text-[var(--a-ikincil)]">Henüz tahsilat yok.</p>;

  const calistir = (is: () => Promise<{ hata: string | null }>) => {
    setHata(null);
    basla(async () => {
      const r = await is();
      if (r.hata) setHata(r.hata);
      else setDuzenlenen(null);
    });
  };

  return (
    <div className="w-full space-y-1.5">
      <p className="text-[12px] font-bold text-[var(--a-ikincil)]">Alınan ödemeler</p>
      <ul className="space-y-1.5 text-[13px]">
        {odemeler.map((o) =>
          duzenlenen === o.id ? (
            <li key={o.id} className="flex items-center gap-1.5">
              <input
                autoFocus
                inputMode="decimal"
                value={yazi}
                onChange={(e) => setYazi(tlGirisBicimle(e.target.value))}
                aria-label="Doğru ödeme tutarı"
                className="min-w-0 flex-1 rounded-xl border border-[#c7cdfb] bg-white px-3 py-2 text-[14px] font-bold tabular-nums outline-none"
              />
              <button type="button" disabled={bekliyor} onClick={() => calistir(() => odemeGuncelle(o.id, yazi))} className="ana-hap !bg-[#4f46e5] !text-white">
                {bekliyor ? "…" : "Kaydet"}
              </button>
              <button type="button" disabled={bekliyor} onClick={() => setDuzenlenen(null)} className="ana-hap">
                Vazgeç
              </button>
            </li>
          ) : (
            <li key={o.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">
                {o.tarihYazi}
                {o.not ? ` · ${o.not}` : ""}
              </span>
              <span className="shrink-0 font-bold tabular-nums text-[#16a34a]">{tlYazKisa(o.tutar)}</span>
              <button
                type="button"
                disabled={bekliyor}
                onClick={() => {
                  setHata(null);
                  setYazi(kurustanGiris(o.tutar));
                  setDuzenlenen(o.id);
                }}
                className="ana-hap !min-h-0 !px-2.5 !py-1 !text-[12px]"
              >
                Düzelt
              </button>
              <button
                type="button"
                disabled={bekliyor}
                onClick={() => confirm(`${o.tarihYazi} tarihli ${tlYazKisa(o.tutar)} ödeme silinsin mi?`) && calistir(() => odemeSil(o.id))}
                className="ana-hap !min-h-0 !px-2.5 !py-1 !text-[12px] !text-[#dc2626]"
              >
                Sil
              </button>
            </li>
          )
        )}
      </ul>
      {hata && (
        <p role="alert" className="text-[12.5px] font-semibold text-[#b91c1c]">
          {hata}
        </p>
      )}
    </div>
  );
}
