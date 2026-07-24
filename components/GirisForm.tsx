"use client";

import { useActionState } from "react";
import { girisYap } from "@/app/auth-actions";
import type { FormSonuc } from "@/app/actions";

export default function GirisForm({ next }: { next: string }) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    girisYap,
    null
  );

  return (
    <form action={aksiyon} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="sifre" className="etiket">
          Şifre
        </label>
        <input
          id="sifre"
          name="sifre"
          type="password"
          required
          autoFocus
          placeholder="Uygulama şifren"
          className="alan"
        />
      </div>
      {durum?.hata && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}
      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
      <p className="text-center text-xs text-[#6a7a90]">
        İlk kurulum şifresi: <strong>nakliye2026</strong> — Ayarlar&apos;dan değiştir.
      </p>
    </form>
  );
}
