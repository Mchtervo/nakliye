"use client";

import { useActionState, useState } from "react";
import { giderEkle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";
import FisYukle from "@/components/FisYukle";
import { GIDER_KATEGORILERI } from "@/lib/sabitler";

export default function GiderForm({ bugunTarih }: { bugunTarih: string }) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    giderEkle,
    null
  );
  const [kategori, setKategori] = useState("YAKIT");

  return (
    <form action={aksiyon} className="space-y-4" encType="multipart/form-data">
      <div>
        <label htmlFor="tarih" className="etiket">
          Tarih
        </label>
        <input
          id="tarih"
          name="tarih"
          type="date"
          required
          defaultValue={bugunTarih}
          className="alan"
        />
      </div>

      <div>
        <label htmlFor="kategori" className="etiket">
          Kategori
        </label>
        <select
          id="kategori"
          name="kategori"
          required
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          className="alan"
        >
          {GIDER_KATEGORILERI.map((k) => (
            <option key={k.kod} value={k.kod}>
              {k.ad}
            </option>
          ))}
        </select>
      </div>

      <TutarKdvGirisi etiket="Gider tutarı" />

      {kategori === "YAKIT" && (
        <div className="grid grid-cols-2 gap-3 reveal">
          <div>
            <label htmlFor="litre" className="etiket">
              Litre (isteğe bağlı)
            </label>
            <input
              id="litre"
              name="litre"
              type="text"
              inputMode="decimal"
              placeholder="Örnek: 350"
              className="alan"
            />
          </div>
          <div>
            <label htmlFor="km" className="etiket">
              Araç km (isteğe bağlı)
            </label>
            <input
              id="km"
              name="km"
              type="text"
              inputMode="numeric"
              placeholder="Örnek: 452000"
              className="alan"
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="aciklama" className="etiket">
          Açıklama (isteğe bağlı)
        </label>
        <input
          id="aciklama"
          name="aciklama"
          type="text"
          placeholder="Örnek: Opet - E5 üzeri"
          className="alan"
        />
      </div>

      <FisYukle />

      {durum?.hata && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}

      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor ? "Kaydediliyor..." : "Gideri Kaydet"}
      </button>
    </form>
  );
}
