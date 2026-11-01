"use client";

import { useActionState, useRef } from "react";
import { uyeOlustur } from "@/app/uye-actions";

/** Yönetici: yeni üye hesabı (kayıt bitince form temizlenir). */
export default function YeniUyeForm() {
  const form = useRef<HTMLFormElement>(null);
  const [durum, aksiyon, bekliyor] = useActionState<{ hata: string | null; tamam: boolean }, FormData>(async (_o, f) => {
    const r = await uyeOlustur(null, f);
    if (!r?.hata) form.current?.reset();
    return { hata: r?.hata ?? null, tamam: !r?.hata };
  }, { hata: null, tamam: false });

  return (
    <form ref={form} action={aksiyon} className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="yu-ad" className="sf-etiket">
            Kullanıcı adı
          </label>
          <div className="sf-alan">
            <input id="yu-ad" name="kullaniciAdi" required autoCapitalize="none" autoComplete="off" placeholder="ornek: ali" className="sf-girdi" />
          </div>
        </div>
        <div>
          <label htmlFor="yu-sifre" className="sf-etiket">
            Şifre
          </label>
          <div className="sf-alan">
            <input id="yu-sifre" name="sifre" required autoComplete="off" placeholder="en az 4" className="sf-girdi" />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="yu-isim" className="sf-etiket">
          Ad soyad <span className="font-medium text-[var(--a-ikincil)]">(isteğe bağlı; üye kendisi de doldurur)</span>
        </label>
        <div className="sf-alan">
          <input id="yu-isim" name="ad" autoComplete="off" className="sf-girdi" />
        </div>
      </div>
      {durum.hata && (
        <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13px] font-semibold text-[#b91c1c]">
          {durum.hata}
        </p>
      )}
      {durum.tamam && !bekliyor && (
        <p role="status" className="rounded-2xl bg-[#dcfce7] px-3 py-2.5 text-center text-[13.5px] font-bold text-[#15803d]">
          ✓ Üye oluşturuldu; boş defteri birkaç dakika içinde hazır olur
        </p>
      )}
      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-12 !text-[15px] disabled:opacity-60">
        {bekliyor ? "Hesap açılıyor…" : "Üye ekle"}
      </button>
    </form>
  );
}
