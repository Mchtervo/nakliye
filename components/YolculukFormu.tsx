"use client";

import { useActionState, useState } from "react";
import { yolculukBaslatForm } from "@/app/ai-actions";

/** "Nereden yükledin, nereye boşaltıyorsun?" — iller + ilçeler kabul. */
export default function YolculukFormu({
  ilkAcik,
  acmaEtiketi = "+ Yeni yolculuk",
  varsayilanYukleme,
  kapatId,
}: {
  /** Açık yolculuk yoksa form direkt görünür. */
  ilkAcik: boolean;
  /** Eskiden datalist içindi (iPad Safari klavye açmıyordu); artık kullanılmıyor. */
  iller?: readonly string[];
  acmaEtiketi?: string;
  /** "Yük aldım": yükleme yeri = şu an boşalttığın yer. */
  varsayilanYukleme?: string;
  /** Kaydedilince bu yolculuğun araması kapanır. */
  kapatId?: number;
}) {
  const [acik, setAcik] = useState(ilkAcik);
  const [durum, gonder, bekliyor] = useActionState(yolculukBaslatForm, { hata: null, tamam: false });
  const liste = `yolculuk-iller-${kapatId ?? "yeni"}`;

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="text-sm font-semibold text-amber">
        {acmaEtiketi}
      </button>
    );
  }

  return (
    <form action={gonder} className="space-y-3">
      {kapatId && <input type="hidden" name="kapat" value={kapatId} />}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`yukleme-${liste}`} className="etiket">
            Yüklediğin yer
          </label>
          <input
            id={`yukleme-${liste}`}
            name="yukleme"
            required
            defaultValue={varsayilanYukleme}
            placeholder="Ankara"
            className="alan"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={`bosaltma-${liste}`} className="etiket">
            Boşaltacağın yer
          </label>
          <input
            id={`bosaltma-${liste}`}
            name="bosaltma"
            required
            autoFocus={Boolean(varsayilanYukleme)}
            placeholder="Düzce"
            className="alan"
            autoComplete="off"
          />
        </div>
      </div>
      {durum.hata && <p className="text-sm font-semibold text-ember">{durum.hata}</p>}
      <button type="submit" disabled={bekliyor} className="btn btn-amber w-full disabled:opacity-60">
        {bekliyor ? "Aranıyor…" : kapatId ? "Yeni yere aramaya başla" : "Dönüş yükü aramaya başla"}
      </button>
    </form>
  );
}
