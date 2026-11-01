"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { kayitOl } from "@/app/auth-actions";
import type { FormSonuc } from "@/app/actions";
import { Alan, DevamDugmesi, IKONLAR, SifreGirdisi, Uyari, telefonBicimle } from "@/components/uyelik/Alanlar";

/** "Seni tanıyalım": ad soyad, telefon, şifre. Hata olursa yazılanlar kalır. */
export default function KayitForm({ smsVar }: { smsVar: boolean }) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(kayitOl, null);
  const [ad, setAd] = useState("");
  const [telefon, setTelefon] = useState("");
  const [sifre, setSifre] = useState("");
  const [kosul, setKosul] = useState(false);

  return (
    <form action={aksiyon} className="space-y-3">
      <Alan etiket="Ad soyad" ikon={IKONLAR.kisi}>
        <input name="ad" required autoComplete="name" value={ad} onChange={(e) => setAd(e.target.value)} className="uy-girdi" placeholder="Adın ve soyadın" />
      </Alan>
      <Alan etiket="Telefon numarası" ikon={IKONLAR.telefon}>
        <input
          name="telefon"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          value={telefon}
          onChange={(e) => setTelefon(telefonBicimle(e.target.value))}
          className="uy-girdi"
          placeholder="05XX XXX XX XX"
        />
      </Alan>
      <Alan etiket="Şifre" ikon={IKONLAR.kilit}>
        <SifreGirdisi ad="sifre" deger={sifre} degis={setSifre} yeni />
      </Alan>

      <label className="flex cursor-pointer items-start gap-3 px-1 py-2 text-[13.5px] text-[#3b4262]">
        <input type="checkbox" name="kosullar" value="1" checked={kosul} onChange={(e) => setKosul(e.target.checked)} className="uy-onay mt-0.5 shrink-0" />
        <span>
          <Link href="/kosullar" target="_blank" className="font-bold text-[#3730a3] underline-offset-2 hover:underline">
            Koşulları
          </Link>{" "}
          okudum ve kabul ediyorum.
        </span>
      </label>

      {durum?.hata && (
        <Uyari>
          {durum.hata}
          {durum.hata.includes("Giriş yap") && (
            <>
              {" "}
              <Link href="/giris?giris=1" className="underline">
                Girişe git
              </Link>
            </>
          )}
        </Uyari>
      )}
      <DevamDugmesi bekliyor={bekliyor}>Devam et</DevamDugmesi>
      <p className="pt-1 text-center text-[12.5px] text-[var(--a-ikincil)]">
        {smsVar ? "Sonraki adım: telefon doğrulama" : "Sonraki adım: aracını tanıyalım"}
      </p>
    </form>
  );
}
