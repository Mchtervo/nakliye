"use client";

import { useState } from "react";
import { kdvHesapla, tlKurusaCevir, tlGirisBicimle, tlYaz, tlYazKisa } from "@/lib/para";

export default function TutarKdvGirisi({
  etiket = "Tutar",
  varsayilanKdvli = true,
  baslangicTutar = "",
  baslangicKdvli,
  baslangicKdvDahilMi = true,
  kdvEtiketi,
  kdvNotu,
  tema = "koyu",
}: {
  /** "acik": sefer formunun açık tasarımı (aynı hesap, farklı görünüm) */
  tema?: "koyu" | "acik";
  etiket?: string;
  varsayilanKdvli?: boolean;
  baslangicTutar?: string;
  baslangicKdvli?: boolean;
  baslangicKdvDahilMi?: boolean;
  /** KDV sütun başlığı (ör. İndirilecek KDV) */
  kdvEtiketi?: string;
  /** Kısa açıklama satırı */
  kdvNotu?: string;
}) {
  const [tutar, setTutar] = useState(baslangicTutar);
  const [kdvli, setKdvli] = useState(
    baslangicKdvli !== undefined ? baslangicKdvli : varsayilanKdvli
  );
  const [kdvDahilMi, setKdvDahilMi] = useState(baslangicKdvDahilMi);

  const kurus = tlKurusaCevir(tutar);
  const hesap =
    kurus !== null && kurus > 0 ? kdvHesapla(kurus, kdvli, kdvDahilMi) : null;

  if (tema === "acik") {
    return (
      <div>
        <input type="hidden" name="kdvli" value={kdvli ? "1" : "0"} />
        <input type="hidden" name="kdvDahilMi" value={kdvDahilMi ? "1" : "0"} />
        <label htmlFor="tutar" className="sf-etiket">
          {etiket}
        </label>
        <div className="sf-alan">
          <span className="sf-alan-ikon !bg-[#4f46e5] !text-white" aria-hidden>
            ₺
          </span>
          <input
            id="tutar"
            name="tutar"
            type="text"
            inputMode="decimal"
            required
            placeholder="Örnek: 20.000"
            value={tutar}
            onChange={(e) => setTutar(tlGirisBicimle(e.target.value))}
            className="sf-girdi !text-[1.15rem] !font-extrabold"
          />
        </div>
        {tutar.trim() !== "" && kurus === null && (
          <p className="mt-1.5 text-[12.5px] font-semibold text-[#dc2626]">Tutar anlaşılamadı. Örnek: 1.670.000 veya 12.000,50</p>
        )}

        <div className="sf-segment mt-2.5" role="group" aria-label="KDV">
          <button type="button" aria-pressed={kdvli && !kdvDahilMi} onClick={() => { setKdvli(true); setKdvDahilMi(false); }} className={`sf-segment-oge ${kdvli && !kdvDahilMi ? "sf-segment-aktif" : ""}`}>
            KDV hariç
          </button>
          <button type="button" aria-pressed={kdvli && kdvDahilMi} onClick={() => { setKdvli(true); setKdvDahilMi(true); }} className={`sf-segment-oge ${kdvli && kdvDahilMi ? "sf-segment-aktif" : ""}`}>
            KDV dahil
          </button>
          <button type="button" aria-pressed={!kdvli} onClick={() => setKdvli(false)} className={`sf-segment-oge ${!kdvli ? "sf-segment-aktif" : ""}`}>
            KDV&apos;siz
          </button>
        </div>

        {hesap && (
          <div className="sf-kdv-ozet mt-2.5">
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-[#3b4262]">Net</span>
              <span className="font-bold tabular-nums">{tlYazKisa(hesap.netTutar)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13.5px]">
              <span className="text-[#3b4262]">{kdvli ? `${kdvEtiketi || "KDV"} (%20)` : "KDV"}</span>
              <span className="font-bold tabular-nums">{kdvli ? tlYazKisa(hesap.kdvTutar) : "Yok"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#e3e6f3] pt-2">
              <span className="text-[15px] font-extrabold">Toplam</span>
              <span className="text-[1.35rem] font-extrabold tabular-nums text-[#4338ca]">{tlYazKisa(hesap.toplamTutar)}</span>
            </div>
            {kdvNotu && <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--a-ikincil)]">{kdvNotu}</p>}
          </div>
        )}
      </div>
    );
  }

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
          placeholder="Örnek: 1.670.000 veya 12.000,50"
          value={tutar}
          onChange={(e) => setTutar(tlGirisBicimle(e.target.value))}
          className="alan font-display text-xl font-bold"
        />
        {kurus !== null && kurus > 0 && (
          <p className="mt-1.5 text-sm font-semibold text-amber">
            Girilen: {tlYaz(kurus)}
          </p>
        )}
        {tutar.trim() !== "" && kurus === null && (
          <p className="mt-1.5 text-sm font-medium text-ember">
            Tutar anlaşılamadı. Örnek: 1.670.000 veya 12.000,50
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
                {kdvEtiketi || "KDV"}
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
          {kdvNotu && (
            <p className="mt-2 text-center text-[11px] leading-snug text-fog">
              {kdvNotu}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
