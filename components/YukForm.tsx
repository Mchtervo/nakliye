"use client";

import { useActionState, useState } from "react";
import { yukEkle, yukGuncelle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";

export type YukFormBaslangic = {
  id: number;
  tarih: string;
  firmaId: number;
  nereden: string;
  nereye: string;
  aciklama: string;
  tutarYazi: string;
  kdvli: boolean;
  kdvDahilMi: boolean;
};

export default function YukForm({
  firmalar,
  bugunTarih,
  baslangic,
}: {
  firmalar: { id: number; ad: string }[];
  bugunTarih: string;
  baslangic?: YukFormBaslangic;
}) {
  const duzenle = Boolean(baslangic);
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    duzenle ? yukGuncelle : yukEkle,
    null
  );
  const [firmaSecim, setFirmaSecim] = useState(
    baslangic
      ? String(baslangic.firmaId)
      : firmalar.length === 0
        ? "yeni"
        : ""
  );

  return (
    <form action={aksiyon} className="space-y-4">
      {baslangic && <input type="hidden" name="yukId" value={baslangic.id} />}

      <div>
        <label htmlFor="tarih" className="etiket">
          Tarih
        </label>
        <input
          id="tarih"
          name="tarih"
          type="date"
          required
          defaultValue={baslangic?.tarih || bugunTarih}
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
            defaultValue={baslangic?.nereden}
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
            defaultValue={baslangic?.nereye}
            className="alan"
          />
        </div>
      </div>

      <TutarKdvGirisi
        etiket="Taşıma ücreti"
        baslangicTutar={baslangic?.tutarYazi || ""}
        baslangicKdvli={baslangic?.kdvli}
        baslangicKdvDahilMi={baslangic?.kdvDahilMi ?? true}
      />

      <div>
        <label htmlFor="aciklama" className="etiket">
          Açıklama (isteğe bağlı)
        </label>
        <input
          id="aciklama"
          name="aciklama"
          type="text"
          placeholder="Örnek: 24 ton demir"
          defaultValue={baslangic?.aciklama || ""}
          className="alan"
        />
      </div>

      {!duzenle && (
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
      )}

      {duzenle && (
        <p className="rounded-xl border border-amber/20 bg-amber/10 px-3 py-2 text-sm text-paper">
          Ödeme durumu mevcut tahsilatlara göre otomatik güncellenir. Eksik ödemeyi
          yük listesinden &quot;Ödeme Gir&quot; ile düzelt.
        </p>
      )}

      {durum?.hata && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}

      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor
          ? "Kaydediliyor..."
          : duzenle
            ? "Değişiklikleri Kaydet"
            : "Yükü Kaydet"}
      </button>
    </form>
  );
}
