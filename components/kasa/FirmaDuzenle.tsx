"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { firmaBirlestir, firmaGuncelle, type FirmaSonuc } from "@/app/firma-actions";
import AltPanel from "@/components/ana/AltPanel";
import { Uyari } from "@/components/uyelik/Alanlar";

type Firma = { id: number; ad: string; telefon: string | null; vergiNo: string | null };

function Form({ firma, kapat }: { firma: Firma; kapat: () => void }) {
  const [durum, aksiyon, bekliyor] = useActionState<FirmaSonuc, FormData>(firmaGuncelle, { hata: null, tamam: false });
  const [birlesiyor, birlestir] = useTransition();
  const [birlestirHata, setBirlestirHata] = useState<string | null>(null);

  useEffect(() => {
    if (durum.tamam) kapat();
  }, [durum, kapat]);

  return (
    <form action={aksiyon} className="space-y-3 px-5 pb-6 pt-1">
      <h2 className="text-[1.3rem] font-extrabold">Firmayı düzenle</h2>
      <input type="hidden" name="firmaId" value={firma.id} />
      <label className="block">
        <span className="ana-etiket">Firma adı</span>
        <input name="ad" required maxLength={120} defaultValue={firma.ad} className="ana-alan" />
      </label>
      <label className="block">
        <span className="ana-etiket">Telefon</span>
        <input name="telefon" type="tel" inputMode="tel" maxLength={30} defaultValue={firma.telefon ?? ""} className="ana-alan" placeholder="İsteğe bağlı" />
      </label>
      <label className="block">
        <span className="ana-etiket">Vergi no</span>
        <input name="vergiNo" inputMode="numeric" maxLength={20} defaultValue={firma.vergiNo ?? ""} className="ana-alan" placeholder="İsteğe bağlı" />
      </label>
      {(durum.hata || birlestirHata) && <Uyari>{birlestirHata || durum.hata}</Uyari>}
      {durum.birlestir && (
        <button
          type="button"
          disabled={birlesiyor}
          onClick={() =>
            confirm(`"${firma.ad}" firmasının seferleri "${durum.birlestir!.ad}" firmasına taşınsın ve bu firma silinsin mi?`) &&
            birlestir(async () => {
              const r = await firmaBirlestir(firma.id, durum.birlestir!.id);
              if (r?.hata) setBirlestirHata(r.hata);
            })
          }
          className="w-full rounded-2xl border border-[var(--a-cizgi)] py-3 text-[14px] font-bold text-[var(--a-indigo)]"
        >
          {birlesiyor ? "Birleştiriliyor…" : `"${durum.birlestir.ad}" ile birleştir`}
        </button>
      )}
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full">
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}

/** Firma detayındaki "Düzenle" düğmesi + alttan açılan form. */
export default function FirmaDuzenle({ firma }: { firma: Firma }) {
  const [acik, setAcik] = useState(false);
  const kapat = () => setAcik(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-[1.4rem] bg-white py-3 text-[14.5px] font-bold text-[var(--a-indigo)] shadow-[var(--a-golge)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
        </svg>
        Firma bilgilerini düzenle
      </button>
      <AltPanel acik={acik} etiket="Firmayı düzenle" kapat={kapat}>
        {acik && <Form firma={firma} kapat={kapat} />}
      </AltPanel>
    </>
  );
}
