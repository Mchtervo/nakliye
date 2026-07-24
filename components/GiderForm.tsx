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

  const demirbas = kategori === "DEMIRBAS";
  const kredi = kategori === "KREDI_ODEME";
  // Demirbaş: KDV'li (indirilecek KDV görünsün). Kredi: genelde KDV'siz.
  const varsayilanKdvli = !kredi;

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

      {demirbas && (
        <div className="rounded-xl border border-amber/25 bg-amber/10 px-3 py-2.5 text-sm text-paper">
          Tır / dorse / ekipman alımı. <strong>İşletme giderine yazılmaz</strong>,
          ama fatura KDV&apos;si panoya yansır. Açıklamaya plaka / model yaz.
        </div>
      )}
      {kredi && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-fog">
          Banka / finansman taksit ödemesi. Genelde KDV&apos;sizdir; gerekirse
          aşağıdan KDV&apos;li seçebilirsin.
        </div>
      )}

      <TutarKdvGirisi
        key={kategori}
        etiket={demirbas ? "Alım tutarı" : kredi ? "Ödeme tutarı" : "Gider tutarı"}
        varsayilanKdvli={varsayilanKdvli}
      />

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
          Açıklama {demirbas ? "(ör. plaka / model)" : "(isteğe bağlı)"}
        </label>
        <input
          id="aciklama"
          name="aciklama"
          type="text"
          placeholder={
            demirbas
              ? "Örnek: 2020 Mercedes Actros · 34 ABC 123"
              : kredi
                ? "Örnek: Garanti — tır kredisi 3. taksit"
                : "Örnek: Opet - E5 üzeri"
          }
          className="alan"
        />
      </div>

      <FisYukle
        vurgulu={demirbas || kredi}
        baslik={
          demirbas
            ? "Fatura fotoğrafı (önerilir)"
            : kredi
              ? "Dekont / makbuz fotoğrafı"
              : "Fatura / fiş fotoğrafı"
        }
        aciklama={
          demirbas
            ? "Tır faturasını çek — Muhasebeciye Gönder sayfasından iletirsin."
            : "Muhasebeciye göndermek için çek veya galeriden seç."
        }
      />

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
