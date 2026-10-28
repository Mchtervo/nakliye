"use client";

import { useActionState } from "react";
import { waDavetEkle, type AiSonuc } from "@/app/ai-actions";

/** Facebook/Instagram/ilan sitelerinden kopyalanan grup linklerini toplu ekler. */
export default function WaDavetForm() {
  const [durum, aksiyon, bekliyor] = useActionState<AiSonuc, FormData>(
    waDavetEkle,
    null
  );

  return (
    <form action={aksiyon} className="space-y-2">
      <label htmlFor="wa-linkler" className="etiket">
        Grup linki ekle
      </label>
      <textarea
        id="wa-linkler"
        name="linkler"
        rows={3}
        placeholder={"https://chat.whatsapp.com/...\nBirden fazla linki alt alta yapıştırabilirsin"}
        className="alan min-h-[5.5rem]"
      />
      <p className="text-xs text-fog">
        Facebook, Instagram veya ilan sitesinde gördüğün grup linklerini yapıştır.
        Numara sırayla girer; yük grubu değilse girmez.
      </p>
      <button
        type="submit"
        disabled={bekliyor}
        className="btn btn-amber w-full !py-2.5 text-sm disabled:opacity-50"
      >
        {bekliyor ? "Ekleniyor..." : "Sıraya ekle"}
      </button>
      {durum && "hata" in durum && (
        <p className="text-sm text-ember">{durum.hata}</p>
      )}
      {durum && "bilgi" in durum && (
        <p className="text-sm text-teal">{durum.bilgi}</p>
      )}
    </form>
  );
}
