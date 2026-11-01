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
export default function KisiselTercih({ iller, anaUs, konumIl, push }: { iller: string[]; anaUs: string; konumIl: string; push: boolean }) {
  const [durum, aksiyon, bekliyor] = useActionState<TercihSonuc, FormData>(kisiselTercihKaydet, { hata: null, tamam: false });
  const [acik, setAcik] = useState(push);
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
      </ul>
      <p className="rp-not">
        <span aria-hidden>ⓘ</span>
        <span>Bakım, belge, kart ve tahsilat hatırlatmaları telefona gelir; kapalıyken yalnız uygulamadaki bildirim kutusunda görünür. Uygun yük bildirimi üyeler için henüz yok.</span>
      </p>
      {durum.hata && <Uyari>{durum.hata}</Uyari>}
      {durum.tamam && !bekliyor && <Uyari ton="tamam">Kaydedildi.</Uyari>}
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-[3.1rem]">
        {bekliyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
