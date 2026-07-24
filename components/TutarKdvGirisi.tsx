"use client";

import { useState } from "react";
import { kdvHesapla, tlKurusaCevir, tlYaz } from "@/lib/para";

export default function TutarKdvGirisi({
  etiket = "Tutar",
  varsayilanKdvli = true,
}: {
  etiket?: string;
  varsayilanKdvli?: boolean;
}) {
  const [tutar, setTutar] = useState("");
  const [kdvli, setKdvli] = useState(varsayilanKdvli);
  const [kdvDahilMi, setKdvDahilMi] = useState(true);

  const kurus = tlKurusaCevir(tutar);
  const hesap =
    kurus !== null && kurus > 0 ? kdvHesapla(kurus, kdvli, kdvDahilMi) : null;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="tutar" className="etiket">
          {etiket} (TL)
        </label>
        <input
          id="tutar"
          name="tutar"
          type="text"
          inputMode="decimal"
          required
          placeholder="Örnek: 12.000 veya 12.000,50"
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          className="alan font-display text-xl font-bold"
        />
        {tutar.trim() !== "" && kurus === null && (
          <p className="mt-1.5 text-sm font-medium text-ember">
            Tutar anlaşılamadı. Örnek: 12.000 veya 12.000,50
          </p>
        )}
      </div>

      <input type="hidden" name="kdvli" value={kdvli ? "1" : "0"} />
      <input type="hidden" name="kdvDahilMi" value={kdvDahilMi ? "1" : "0"} />

      <div>
        <span className="etiket">Bu iş KDV&apos;li mi?</span>
        <div className="secenek-grup">
          <button
            type="button"
            className={`secenek ${kdvli ? "aktif" : ""}`}
            onClick={() => setKdvli(true)}
          >
            KDV&apos;li (%20)
          </button>
          <button
            type="button"
            className={`secenek ${!kdvli ? "aktif" : ""}`}
            onClick={() => setKdvli(false)}
          >
            KDV&apos;siz
          </button>
        </div>
      </div>

      {kdvli && (
        <div className="reveal">
          <span className="etiket">Girdiğin tutar KDV dahil mi?</span>
          <div className="secenek-grup">
            <button
              type="button"
              className={`secenek ${kdvDahilMi ? "aktif" : ""}`}
              onClick={() => setKdvDahilMi(true)}
            >
              KDV Dahil
            </button>
            <button
              type="button"
              className={`secenek ${!kdvDahilMi ? "aktif" : ""}`}
              onClick={() => setKdvDahilMi(false)}
            >
              KDV Hariç
            </button>
          </div>
        </div>
      )}

      {hesap && (
        <div className="reveal overflow-hidden rounded-xl border border-amber/20 bg-asphalt p-3 text-paper">
          <div className="lane-strip mb-3 opacity-60" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                Net
              </div>
              <div className="mt-1 font-display text-sm font-bold sm:text-base">
                {tlYaz(hesap.netTutar)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                KDV
              </div>
              <div className="mt-1 font-display text-sm font-bold text-amber sm:text-base">
                {tlYaz(hesap.kdvTutar)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                Toplam
              </div>
              <div className="mt-1 font-display text-sm font-bold text-teal sm:text-base">
                {tlYaz(hesap.toplamTutar)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
