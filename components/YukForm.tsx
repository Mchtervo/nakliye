"use client";

import { useActionState, useState } from "react";
import { yukEkle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";

export default function YukForm({
  firmalar,
  bugunTarih,
}: {
  firmalar: { id: number; ad: string }[];
  bugunTarih: string;
}) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    yukEkle,
    null
  );
  const [firmaSecim, setFirmaSecim] = useState(
    firmalar.length === 0 ? "yeni" : ""
  );

  return (
    <form action={aksiyon} className="space-y-4">
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
        <label htmlFor="firmaId" className="etiket">
          Firma
        </label>
        <select
          id="firmaId"
          name="firmaId"
          required
          value={firmaSecim}
          onChange={(e) => setFirmaSecim(e.target.value)}
          className="alan"
        >
          <option value="" disabled>
            Firma seç...
          </option>
          {firmalar.map((f) => (
            <option key={f.id} value={f.id}>
              {f.ad}
            </option>
          ))}
          <option value="yeni">+ Yeni firma ekle</option>
        </select>
      </div>

      {firmaSecim === "yeni" && (
        <div className="reveal">
          <label htmlFor="yeniFirmaAdi" className="etiket">
            Yeni firma adı
          </label>
          <input
            id="yeniFirmaAdi"
            name="yeniFirmaAdi"
            type="text"
            required
            placeholder="Örnek: ABC Lojistik"
            className="alan"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nereden" className="etiket">
            Nereden
          </label>
          <input
            id="nereden"
            name="nereden"
            type="text"
            required
            placeholder="Örnek: Mersin"
            className="alan"
          />
        </div>
        <div>
          <label htmlFor="nereye" className="etiket">
            Nereye
          </label>
          <input
            id="nereye"
            name="nereye"
            type="text"
            required
            placeholder="Örnek: İstanbul"
            className="alan"
          />
        </div>
      </div>

      <TutarKdvGirisi etiket="Taşıma ücreti" />

      <div>
        <label htmlFor="aciklama" className="etiket">
          Açıklama (isteğe bağlı)
        </label>
        <input
          id="aciklama"
          name="aciklama"
          type="text"
          placeholder="Örnek: 24 ton demir"
          className="alan"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/8 bg-white p-3">
        <input
          type="checkbox"
          name="odendiMi"
          value="1"
          className="h-5 w-5 rounded accent-[#f0a020]"
        />
        <span className="text-sm font-semibold text-ink">
          Ödemesi peşin alındı (ödendi olarak kaydet)
        </span>
      </label>

      {durum?.hata && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}

      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor ? "Kaydediliyor..." : "Yükü Kaydet"}
      </button>
    </form>
  );
}
