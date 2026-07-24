"use client";

import { useActionState } from "react";
import { sifreDegistir } from "@/app/auth-actions";

type Sonuc = { hata: string } | { ok: true } | null;

async function aksiyonSarici(_o: Sonuc, fd: FormData): Promise<Sonuc> {
  const r = await sifreDegistir(null, fd);
  if (r?.hata) return r;
  return { ok: true };
}

export default function SifreDegistirForm() {
  const [durum, aksiyon, bekliyor] = useActionState<Sonuc, FormData>(
    aksiyonSarici,
    null
  );

  return (
    <form action={aksiyon} className="space-y-3">
      <div>
        <label htmlFor="mevcut" className="etiket">
          Mevcut şifre
        </label>
        <input id="mevcut" name="mevcut" type="password" required className="alan" />
      </div>
      <div>
        <label htmlFor="yeni" className="etiket">
          Yeni şifre
        </label>
        <input id="yeni" name="yeni" type="password" required minLength={4} className="alan" />
      </div>
      <div>
        <label htmlFor="yeni2" className="etiket">
          Yeni şifre (tekrar)
        </label>
        <input id="yeni2" name="yeni2" type="password" required minLength={4} className="alan" />
      </div>
      {durum && "hata" in durum && (
        <p className="text-sm font-semibold text-ember">{durum.hata}</p>
      )}
      {durum && "ok" in durum && (
        <p className="text-sm font-semibold text-ok">Şifre değiştirildi.</p>
      )}
      <button type="submit" disabled={bekliyor} className="btn btn-amber">
        {bekliyor ? "Kaydediliyor..." : "Şifreyi Değiştir"}
      </button>
    </form>
  );
}
