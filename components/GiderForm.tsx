"use client";

import { useActionState, useState } from "react";
import { giderEkle, giderGuncelle, type FormSonuc } from "@/app/actions";
import TutarKdvGirisi from "@/components/TutarKdvGirisi";
import FisYukle from "@/components/FisYukle";
import { giderKategoriGruplari } from "@/lib/sabitler";

export type GiderFormBaslangic = {
  id: number;
  tarih: string;
  kategori: string;
  aciklama: string;
  tutarYazi: string;
  kdvli: boolean;
  kdvDahilMi: boolean;
  litre: string;
  km: string;
  fisResmi: string | null;
};

export default function GiderForm({
  bugunTarih,
  baslangic,
}: {
  bugunTarih: string;
  baslangic?: GiderFormBaslangic;
}) {
  const duzenle = Boolean(baslangic);
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    duzenle ? giderGuncelle : giderEkle,
    null
  );
  const [kategori, setKategori] = useState(baslangic?.kategori || "YAKIT");
  const [fisSil, setFisSil] = useState(false);

  const demirbas = kategori === "DEMIRBAS";
  const kredi = kategori === "KREDI_ODEME";
  const varsayilanKdvli =
    baslangic?.kdvli !== undefined ? baslangic.kdvli : !kredi;

  return (
    <form action={aksiyon} className="space-y-4" encType="multipart/form-data">
      {baslangic && <input type="hidden" name="giderId" value={baslangic.id} />}
      {fisSil && <input type="hidden" name="fisSil" value="1" />}

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
          {giderKategoriGruplari().map((g) => (
            <optgroup key={g.grup} label={g.ad}>
              {g.kategoriler.map((k) => (
                <option key={k.kod} value={k.kod}>
                  {k.ad}
                </option>
              ))}
            </optgroup>
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
        key={`${kategori}-${baslangic?.id || "yeni"}`}
        etiket={demirbas ? "Alım tutarı" : kredi ? "Ödeme tutarı" : "Gider tutarı"}
        varsayilanKdvli={varsayilanKdvli}
        baslangicTutar={baslangic?.tutarYazi || ""}
        baslangicKdvli={baslangic?.kdvli}
        baslangicKdvDahilMi={baslangic?.kdvDahilMi ?? true}
        kdvEtiketi="İndirilecek KDV"
        kdvNotu="Bu KDV’yi devlete ekstra ödemezsin; yüklerden gelen KDV borcundan düşülür."
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
              defaultValue={baslangic?.litre || ""}
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
              defaultValue={baslangic?.km || ""}
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
          defaultValue={baslangic?.aciklama || ""}
          className="alan"
        />
      </div>

      {baslangic?.fisResmi && !fisSil && (
        <div className="space-y-2 rounded-xl border border-white/12 bg-white/4 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fog">
            Mevcut fatura / fiş
          </div>
          <a href={baslangic.fisResmi} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={baslangic.fisResmi}
              alt="Mevcut fiş"
              className="max-h-40 w-full rounded-lg object-contain bg-black/30"
            />
          </a>
          <button
            type="button"
            onClick={() => setFisSil(true)}
            className="text-sm font-semibold text-ember hover:underline"
          >
            Bu fişi kaldır
          </button>
        </div>
      )}

      <FisYukle
        vurgulu={demirbas || kredi}
        baslik={
          baslangic?.fisResmi && !fisSil
            ? "Yeni fatura / fiş (değiştirmek için)"
            : demirbas
              ? "Fatura fotoğrafı (önerilir)"
              : kredi
                ? "Dekont / makbuz fotoğrafı"
                : "Fatura / fiş fotoğrafı"
        }
        aciklama="Çek veya seç — tutarı elle gir, fiş olduğu gibi kaydolur. AI okuma yok."
      />

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
            : "Gideri Kaydet"}
      </button>
    </form>
  );
}
