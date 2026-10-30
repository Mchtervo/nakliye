"use client";

import { useActionState, useState } from "react";
import { yolculukBaslatForm } from "@/app/ai-actions";

/** "Nereden yükledin, nereye boşaltıyorsun?" — iller + ilçeler kabul. */
export default function YolculukFormu({
  ilkAcik,
  iller,
}: {
  /** Açık yolculuk yoksa form direkt görünür. */
  ilkAcik: boolean;
  iller: readonly string[];
}) {
  const [acik, setAcik] = useState(ilkAcik);
  const [durum, gonder, bekliyor] = useActionState(yolculukBaslatForm, { hata: null, tamam: false });

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="text-sm font-semibold text-amber">
        + Yeni yolculuk
      </button>
    );
  }

  return (
    <form action={gonder} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="yukleme" className="etiket">
            Yüklediğin yer
          </label>
          <input id="yukleme" name="yukleme" list="yolculuk-iller" required placeholder="Ankara" className="alan" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="bosaltma" className="etiket">
            Boşaltacağın yer
          </label>
          <input id="bosaltma" name="bosaltma" list="yolculuk-iller" required placeholder="Düzce" className="alan" autoComplete="off" />
        </div>
      </div>
      <datalist id="yolculuk-iller">
        {iller.map((il) => (
          <option key={il} value={il} />
        ))}
      </datalist>
      {durum.hata && <p className="text-sm font-semibold text-ember">{durum.hata}</p>}
      <button type="submit" disabled={bekliyor} className="btn btn-amber w-full disabled:opacity-60">
        {bekliyor ? "Aranıyor…" : "Dönüş yükü aramaya başla"}
      </button>
    </form>
  );
}
