"use client";

import { m } from "motion/react";
import { useActionState, useState } from "react";
import { yolculukBaslatForm } from "@/app/ai-actions";

/** "Nereden yükledin, nereye boşaltıyorsun?" — iller + ilçeler kabul. */
export default function YolculukFormu({
  ilkAcik,
  acmaEtiketi = "+ Yeni yolculuk",
  varsayilanYukleme,
  kapatId,
  tema = "koyu",
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
  /** "acik": ana sayfanın açık tasarımı */
  tema?: "koyu" | "acik";
}) {
  const [acik, setAcik] = useState(ilkAcik);
  const [durum, gonder, bekliyor] = useActionState(yolculukBaslatForm, { hata: null, tamam: false });
  const liste = `yolculuk-iller-${kapatId ?? "yeni"}`;
  const acikTema = tema === "acik";
  const alan = acikTema ? "ana-alan" : "alan";
  const etiket = acikTema ? "ana-etiket" : "etiket";

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className={acikTema ? "ana-link inline-flex items-center gap-1.5" : "text-sm font-semibold text-amber"}
      >
        {acmaEtiketi}
      </button>
    );
  }

  const form = (
    <form action={gonder} className="space-y-3">
      {kapatId && <input type="hidden" name="kapat" value={kapatId} />}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`yukleme-${liste}`} className={etiket}>
            Yüklediğin yer
          </label>
          <input
            id={`yukleme-${liste}`}
            name="yukleme"
            required
            defaultValue={varsayilanYukleme}
            placeholder="Ankara"
            className={alan}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={`bosaltma-${liste}`} className={etiket}>
            Boşaltacağın yer
          </label>
          <input
            id={`bosaltma-${liste}`}
            name="bosaltma"
            required
            autoFocus={Boolean(varsayilanYukleme)}
            placeholder="Düzce"
            className={alan}
            autoComplete="off"
          />
        </div>
      </div>
      {durum.hata && (
        <p role="alert" className={`text-sm font-semibold ${acikTema ? "text-[#dc2626]" : "text-ember"}`}>
          {durum.hata}
        </p>
      )}
      {acikTema && durum.tamam && !bekliyor && (
        <p role="status" className="text-sm font-semibold text-[#16a34a]">
          ✓ Yolculuk kaydedildi, arama başladı.
        </p>
      )}
      <button
        type="submit"
        disabled={bekliyor}
        className={acikTema ? "ana-ana-dugme w-full disabled:opacity-60" : "btn btn-amber w-full disabled:opacity-60"}
      >
        {bekliyor ? "Kaydediliyor…" : kapatId ? "Yeni yere aramaya başla" : "Dönüş yükü aramaya başla"}
      </button>
    </form>
  );

  if (!acikTema) return form;
  // Açılan panel: kısa, az salınımlı yay
  return (
    <m.div
      className="basis-full overflow-hidden"
      initial={ilkAcik ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
    >
      {form}
    </m.div>
  );
}
