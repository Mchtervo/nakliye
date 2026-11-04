"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { girisYap } from "@/app/auth-actions";
import type { FormSonuc } from "@/app/actions";
import AltPanel from "@/components/ana/AltPanel";
import { Alan, DevamDugmesi, IKONLAR, SifreGirdisi, Uyari, telefonBicimle } from "@/components/uyelik/Alanlar";

const OZELLIKLER = [
  { ad: "Sana uygun", ikon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12 19 5" /></> },
  { ad: "Güncel ilanlar", ikon: <><rect x="5.5" y="3.5" width="13" height="17" rx="2.5" /><path d="M9 8.5h6M9 12.5h6M9 16.5h4" /></> },
  { ad: "Kolay iletişim", ikon: <><path d="M5 17.5V7a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7v6a2.5 2.5 0 0 1-2.5 2.5H9z" /><path d="M9 9.5h6M9 12h4" /></> },
];

function GirisFormu({ next }: { next: string }) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(girisYap, null);
  const [yonetici, setYonetici] = useState(false);
  const [kimlik, setKimlik] = useState("");
  const [sifre, setSifre] = useState("");

  return (
    <form action={aksiyon} className="space-y-3 px-5 pb-6 pt-2">
      <h2 className="text-[1.45rem] font-extrabold tracking-[-0.02em]">{yonetici ? "Yönetici girişi" : "Giriş yap"}</h2>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="yonetici" value={yonetici ? "1" : "0"} />
      {!yonetici && (
        <Alan etiket="Telefon numarası" ikon={IKONLAR.telefon}>
          <input
            name="kimlik"
            type="text"
            inputMode={/[a-z]/i.test(kimlik) ? "text" : "tel"}
            autoComplete="username"
            autoCapitalize="none"
            required
            placeholder="05XX XXX XX XX"
            value={kimlik}
            onChange={(e) => setKimlik(/[a-zçğıöşü]/i.test(e.target.value) ? e.target.value : telefonBicimle(e.target.value))}
            className="uy-girdi"
          />
        </Alan>
      )}
      <Alan etiket="Şifre" ikon={IKONLAR.kilit}>
        <SifreGirdisi ad="sifre" deger={sifre} degis={setSifre} />
      </Alan>
      {durum?.hata && <Uyari>{durum.hata}</Uyari>}
      <DevamDugmesi bekliyor={bekliyor}>Giriş yap</DevamDugmesi>
      <div className="flex items-center justify-between px-1 pt-1 text-[13.5px]">
        <Link href="/sifre-unuttum" className="ana-link font-bold">
          Şifremi unuttum
        </Link>
        <button type="button" onClick={() => setYonetici((y) => !y)} className="font-semibold text-[var(--a-ikincil)]">
          {yonetici ? "Üye girişi" : "Yönetici girişi"}
        </button>
      </div>
    </form>
  );
}

/** Karşılama: "Hesap oluştur" / "Giriş yap" (giriş alttan açılan panelde). */
export default function Karsilama({ next, girisAcik, kapandi }: { next: string; girisAcik: boolean; kapandi: boolean }) {
  const [acik, setAcik] = useState(girisAcik);

  return (
    <div className="uy-kabuk">
      <div className="ana-ic flex min-h-[100dvh] flex-col pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="ana-gir flex items-center gap-2">
          <Image src="/ana/logo-2.png" alt="" width={40} height={36} className="h-9 w-10" priority />
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#1e1b6b]">Yük Avcısı</span>
        </div>

        <h1 className="ana-gir mt-7 text-[2.35rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#0e1534]" style={{ animationDelay: "50ms" }}>
          Yükün hazır.
          <br />
          <span className="text-[#5b62e8]">Yola çık.</span>
        </h1>
        <p className="ana-gir mt-2 text-[15px] text-[#4b5375]" style={{ animationDelay: "90ms" }}>
          Aracına uygun yükleri ve işinin hesabını tek yerde tut.
        </p>

        <div className="ana-gir relative -mx-4 mt-2 flex-1" style={{ animationDelay: "120ms" }}>
          <Image src="/ana/arac/karsilama.webp" alt="" width={570} height={490} className="uy-karsilama-gorsel" priority />
        </div>

        {kapandi && (
          <div className="mb-3">
            <Uyari ton="bilgi">Oturumun kapandı. Yeniden giriş yap.</Uyari>
          </div>
        )}

        <ul className="ana-gir grid grid-cols-3 gap-2.5" style={{ animationDelay: "160ms" }}>
          {OZELLIKLER.map((o) => (
            <li key={o.ad} className="uy-ozellik">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-[#4f46e5]" aria-hidden>
                {o.ikon}
              </svg>
              <span>{o.ad}</span>
            </li>
          ))}
        </ul>

        <Link href="/kayit" className="uy-devam ana-gir mt-5" style={{ animationDelay: "200ms" }}>
          <span className="flex-1 text-center">Hesap oluştur</span>
          <span className="uy-devam-ok" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
        <p className="ana-gir mt-4 text-center text-[14.5px] text-[#4b5375]" style={{ animationDelay: "230ms" }}>
          Hesabın var mı?{" "}
          <button type="button" onClick={() => setAcik(true)} className="font-extrabold text-[#3730a3]">
            Giriş yap
          </button>
        </p>
        <p className="ana-gir mt-2 text-center text-[13.5px]" style={{ animationDelay: "260ms" }}>
          <Link href="/ilanlar" className="font-bold text-[#4b5375] underline underline-offset-4">
            Önce güncel ilanlara göz at
          </Link>
        </p>
      </div>

      <AltPanel acik={acik} etiket="Giriş yap" kapat={() => setAcik(false)}>
        <GirisFormu next={next} />
      </AltPanel>
    </div>
  );
}
