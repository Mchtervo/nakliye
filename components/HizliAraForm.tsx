"use client";

import { useActionState } from "react";
import { hizliAraNumaraKaydet, type FormSonuc } from "@/app/actions";

export default function HizliAraForm({ baslangic }: { baslangic: string }) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    hizliAraNumaraKaydet,
    null
  );

  return (
    <form action={aksiyon} className="space-y-3">
      <div>
        <label htmlFor="hizli-ara" className="etiket !text-fog">
          Hızlı ara numarası
        </label>
        <input
          id="hizli-ara"
          name="telefon"
          type="tel"
          inputMode="tel"
          defaultValue={baslangic}
          placeholder="05XX XXX XX XX"
          className="alan"
          required
        />
        <p className="mt-1 text-xs text-fog">
          Ana ekrandaki Ara butonu bu numarayı çevirir (eş, ortak, ofis…).
        </p>
      </div>
      {durum?.hata && (
        <p className="text-sm font-semibold text-ember">{durum.hata}</p>
      )}
      {!durum?.hata && durum === null && baslangic && (
        <p className="text-xs text-ok">Kayıtlı numara hazır.</p>
      )}
      <button type="submit" disabled={bekliyor} className="btn btn-teal !py-2 text-sm">
        {bekliyor ? "Kaydediliyor..." : "Numarayı Kaydet"}
      </button>
    </form>
  );
}
