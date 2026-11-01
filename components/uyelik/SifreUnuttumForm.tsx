"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sifreKoduIste, sifreSifirla, type KodSonuc } from "@/app/auth-actions";
import { Alan, DevamDugmesi, IKONLAR, SifreGirdisi, Uyari, telefonBicimle } from "@/components/uyelik/Alanlar";

const BOS: KodSonuc = { hata: null, tamam: false };

/** Şifremi unuttum: telefon → SMS kodu → yeni şifre. SMS kurulu değilse açıkça söyler. */
export default function SifreUnuttumForm({ smsVar }: { smsVar: boolean }) {
  const [istek, istekAksiyon, istekBekliyor] = useActionState(sifreKoduIste, BOS);
  const [sonuc, sifirlaAksiyon, sifirlaBekliyor] = useActionState(sifreSifirla, BOS);
  const [telefon, setTelefon] = useState("");
  const [kod, setKod] = useState("");
  const [yeni, setYeni] = useState("");

  if (!smsVar) {
    return (
      <div className="space-y-4">
        <Uyari ton="bilgi">
          SMS hizmeti henüz kurulu değil, bu yüzden şifre sıfırlama kodu gönderilemiyor. Şifreni yöneticiden sıfırlamasını iste; yönetici
          yeni şifre verince eski oturumların hepsi kapanır.
        </Uyari>
        <Link href="/giris?giris=1" className="uy-devam">
          <span className="flex-1 text-center">Girişe dön</span>
        </Link>
      </div>
    );
  }

  if (sonuc.tamam) {
    return (
      <div className="space-y-4">
        <Uyari ton="tamam">Şifren değişti. Diğer cihazlardaki oturumlar kapandı.</Uyari>
        <Link href="/giris?giris=1" className="uy-devam">
          <span className="flex-1 text-center">Giriş yap</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form action={istekAksiyon} className="space-y-3">
        <Alan etiket="Telefon numarası" ikon={IKONLAR.telefon}>
          <input name="telefon" type="tel" inputMode="tel" required value={telefon} onChange={(e) => setTelefon(telefonBicimle(e.target.value))} className="uy-girdi" placeholder="05XX XXX XX XX" />
        </Alan>
        {istek.hata && <Uyari>{istek.hata}</Uyari>}
        {!istek.tamam && <DevamDugmesi bekliyor={istekBekliyor}>Kod gönder</DevamDugmesi>}
      </form>
      {istek.tamam && (
        <form action={sifirlaAksiyon} className="space-y-3">
          <input type="hidden" name="telefon" value={telefon} />
          <Uyari ton="bilgi">Bu numara kayıtlıysa 6 haneli kod gönderildi.</Uyari>
          <Alan etiket="SMS kodu" ikon={IKONLAR.kod}>
            <input name="kod" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={kod} onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))} className="uy-girdi tracking-[0.3em]" placeholder="••••••" />
          </Alan>
          <Alan etiket="Yeni şifre" ikon={IKONLAR.kilit}>
            <SifreGirdisi ad="yeni" deger={yeni} degis={setYeni} yeni />
          </Alan>
          {sonuc.hata && <Uyari>{sonuc.hata}</Uyari>}
          <DevamDugmesi bekliyor={sifirlaBekliyor}>Şifreyi değiştir</DevamDugmesi>
        </form>
      )}
    </div>
  );
}
