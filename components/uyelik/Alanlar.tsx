"use client";

import { m } from "motion/react";
import { useState, type ReactNode } from "react";

export const IKONLAR = {
  kisi: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
    </>
  ),
  telefon: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  kilit: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  kod: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="3" />
      <path d="M7.5 12h.01M12 12h.01M16.5 12h.01" />
    </>
  ),
};

/** Etiketli, ikonlu alan kutusu (referanstaki beyaz kart içinde alan). */
export function Alan({
  etiket,
  ikon,
  children,
  ipucu,
}: {
  etiket: string;
  ikon: ReactNode;
  children: ReactNode;
  ipucu?: string;
}) {
  return (
    <label className="uy-alan-kart block">
      <span className="uy-alan-etiket">{etiket}</span>
      <span className="uy-alan-satir">
        <span className="uy-alan-ikon" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ikon}
          </svg>
        </span>
        {children}
      </span>
      {ipucu && <span className="mt-1.5 block px-1 text-[12px] text-[var(--a-ikincil)]">{ipucu}</span>}
    </label>
  );
}

/** Göster/gizle düğmeli şifre girişi (değer dışarıda tutulur; hata olunca kaybolmaz). */
export function SifreGirdisi({
  ad,
  deger,
  degis,
  yeni = false,
  id,
}: {
  ad: string;
  deger: string;
  degis: (v: string) => void;
  yeni?: boolean;
  id?: string;
}) {
  const [goster, setGoster] = useState(false);
  return (
    <>
      <input
        id={id}
        name={ad}
        type={goster ? "text" : "password"}
        required
        autoComplete={yeni ? "new-password" : "current-password"}
        value={deger}
        onChange={(e) => degis(e.target.value)}
        className="uy-girdi"
        placeholder={yeni ? "En az 6 karakter" : "Şifren"}
      />
      <button type="button" onClick={() => setGoster((g) => !g)} className="uy-goz" aria-label={goster ? "Şifreyi gizle" : "Şifreyi göster"} aria-pressed={goster}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.8" />
          {!goster && <path d="M4 20 20 4" />}
        </svg>
      </button>
    </>
  );
}

/** Hata / bilgi kutusu: kısa kayarak gelir, ekran okuyucuya duyurulur. */
export function Uyari({ ton = "hata", children }: { ton?: "hata" | "bilgi" | "tamam"; children: ReactNode }) {
  const renk =
    ton === "hata" ? "bg-[#fee2e2] text-[#b91c1c]" : ton === "tamam" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#eef0ff] text-[#3730a3]";
  return (
    <m.p
      role={ton === "hata" ? "alert" : "status"}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-[1.1rem] px-3.5 py-3 text-[13.5px] font-semibold leading-snug ${renk}`}
    >
      {children}
    </m.p>
  );
}

/** Ana düğme: sağda beyaz ok dairesi (referans). Beklerken kilitli. */
export function DevamDugmesi({ children, bekliyor, disabled }: { children: ReactNode; bekliyor?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={bekliyor || disabled} className="uy-devam">
      <span className="flex-1 text-center">{bekliyor ? "Bekle…" : children}</span>
      <span className="uy-devam-ok" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

/** Telefonu yazarken "0532 123 45 67" biçimine getirir. */
export function telefonBicimle(ham: string): string {
  let d = ham.replace(/\D/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d && !d.startsWith("0")) d = `0${d}`;
  d = d.slice(0, 11);
  const p = [d.slice(0, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)].filter(Boolean);
  return p.join(" ");
}
