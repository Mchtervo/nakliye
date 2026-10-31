"use client";

import { useActionState, useState } from "react";
import { aracKaydet, type AracSonuc } from "@/app/actions";

/** Gösterge km + bakım aralığı + son bakım km. Kayıtlı değer yoksa açık gelir. */
export default function AracKmFormu({
  ilkAcik,
  kmSayac,
  bakimAralikKm,
  sonBakimKm,
}: {
  ilkAcik: boolean;
  kmSayac: number | null;
  bakimAralikKm: number | null;
  sonBakimKm: number | null;
}) {
  const [acik, setAcik] = useState(ilkAcik);
  const [durum, gonder, bekliyor] = useActionState<AracSonuc, FormData>(aracKaydet, {
    hata: null,
    tamam: false,
  });

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="text-sm font-semibold text-amber">
        Göstergeyi / bakım ayarını güncelle
      </button>
    );
  }

  const alan = (ad: string, etiket: string, deger: number | null, ornek: string, aciklama: string) => (
    <div>
      <label htmlFor={ad} className="etiket">
        {etiket}
      </label>
      <input
        id={ad}
        name={ad}
        type="text"
        inputMode="numeric"
        defaultValue={deger != null ? deger.toLocaleString("tr-TR") : ""}
        placeholder={ornek}
        className="alan"
        autoComplete="off"
      />
      <p className="mt-1 text-xs text-fog">{aciklama}</p>
    </div>
  );

  return (
    <form
      action={async (f) => {
        await gonder(f);
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {alan("kmSayac", "Göstergedeki km", kmSayac, "Örnek: 485.000", "Aracın şu anki km'si")}
        {alan("bakimAralikKm", "Bakım aralığı", bakimAralikKm, "Örnek: 15.000", "Kaç km'de bir bakım")}
        {alan("sonBakimKm", "Son bakım km", sonBakimKm, "Örnek: 480.000", "Son bakım yapıldığında gösterge")}
      </div>
      {durum.hata && <p className="text-sm font-semibold text-ember">{durum.hata}</p>}
      {durum.tamam && !durum.hata && <p className="text-sm font-semibold text-ok">Kaydedildi.</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={bekliyor} className="btn btn-amber flex-1 disabled:opacity-60">
          {bekliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {!ilkAcik && (
          <button type="button" onClick={() => setAcik(false)} className="btn btn-ghost">
            Kapat
          </button>
        )}
      </div>
    </form>
  );
}
