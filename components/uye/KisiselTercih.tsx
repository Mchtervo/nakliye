"use client";

import { m } from "motion/react";
import { useActionState, useState } from "react";
import { kisiselTercihKaydet, type TercihSonuc } from "@/app/uye-actions";
import { Uyari } from "@/components/uyelik/Alanlar";

function Satir({ etiket, ikon, ton, children }: { etiket: string; ikon: React.ReactNode; ton: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 border-b border-[var(--a-cizgi)] py-2.5 last:border-0">
      <span className={`ana-mini-ikon rp-ikon ${ton}`} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ikon}
        </svg>
      </span>
      <span className="flex-1 text-[15px] font-semibold">{etiket}</span>
      {children}
    </label>
  );
}

/** Kişisel tercihler: ana üs, aracın konumu, telefona bildirim. Başarı yalnız kayıt bitince. */
export default function KisiselTercih({
  iller,
  anaUs,
  konumIl,
  push,
  yukler = true,
}: {
  iller: string[];
  anaUs: string;
  konumIl: string;
  push: boolean;
  /** "Yük bul" bölümü açık mı */
  yukler?: boolean;
}) {
  const [durum, aksiyon, bekliyor] = useActionState<TercihSonuc, FormData>(kisiselTercihKaydet, { hata: null, tamam: false });
  const [acik, setAcik] = useState(push);
  const [yukAcik, setYukAcik] = useState(yukler);
  const secici = (ad: string, deger: string) => (
    <select name={ad} defaultValue={deger} className="uy-secici max-w-[9.5rem] bg-transparent text-right text-[14.5px] font-bold text-[#3730a3] outline-none">
      <option value="">Seç</option>
      {iller.map((il) => (
        <option key={il}>{il}</option>
      ))}
    </select>
  );
  return (
    <form action={aksiyon} className="space-y-3">
      <ul className="rp-kart px-3">
        <li>
          <Satir etiket="Ana üs" ton="ana-ton-indigo" ikon={<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></>}>
            {secici("anaUs", anaUs)}
          </Satir>
        </li>
        <li>
          <Satir etiket="Aracın konumu" ton="ana-ton-turuncu" ikon={<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></>}>
            {secici("konumIl", konumIl)}
          </Satir>
        </li>
        <li>
          <Satir etiket="Telefona bildirim" ton="ana-ton-indigo" ikon={<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />}>
            <input type="hidden" name="push" value={acik ? "1" : "0"} />
            <button type="button" role="switch" aria-checked={acik} onClick={() => setAcik((a) => !a)} className={`kt-anahtar ${acik ? "kt-anahtar-acik" : ""}`}>
              <m.span layout transition={{ type: "spring", stiffness: 600, damping: 36 }} className="kt-anahtar-top" />
            </button>
          </Satir>
        </li>
        <li>
          <Satir etiket={yukAcik ? "Yükler açık" : "Yükler kapalı"} ton="ana-ton-turuncu" ikon={<><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" /><circle cx="6.5" cy="17" r="1.8" /><circle cx="17" cy="17" r="1.8" /></>}>
            <input type="hidden" name="yukler" value={yukAcik ? "1" : "0"} />
            <button type="button" role="switch" aria-checked={yukAcik} aria-label="Yük ilanlarını aç / kapat" onClick={() => setYukAcik((a) => !a)} className={`kt-anahtar ${yukAcik ? "kt-anahtar-acik" : ""}`}>
              <m.span layout transition={{ type: "spring", stiffness: 600, damping: 36 }} className="kt-anahtar-top" />
            </button>
          </Satir>
        </li>
      </ul>
      <p className="rp-not">
        <span aria-hidden>ⓘ</span>
        <span>Yükler kapalıyken menüde ve ana sayfada &quot;Yük bul&quot; görünmez; yalnız sefer, gider ve hesap kısmı kalır. İstediğin zaman buradan açarsın.</span>
      </p>
      <p className="rp-not">
        <span aria-hidden>ⓘ</span>
        <span>Bakım, belge, kart ve tahsilat hatırlatmaları, başka telefondan girilen yeni seferler ve günde iki kez &quot;bugün sefer yazdın mı?&quot; telefona gelir; kapalıyken yalnız uygulamadaki bildirim kutusunda görünür. Uygun yük bildirimi üyeler için henüz yok.</span>
      </p>
      {durum.hata && <Uyari>{durum.hata}</Uyari>}
      {durum.tamam && !bekliyor && <Uyari ton="tamam">Kaydedildi.</Uyari>}
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-[3.1rem]">
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
