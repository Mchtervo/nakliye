"use client";

import { useState, useTransition } from "react";
import { tumCihazlardanCik } from "@/app/auth-actions";

/** Diğer cihazlardaki oturumları kapatır; başarı yalnız işlem bitince görünür. */
export default function TumCihazlar() {
  const [bekliyor, baslat] = useTransition();
  const [sonuc, setSonuc] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={bekliyor}
        onClick={() =>
          confirm("Bu cihaz dışındaki tüm oturumların kapansın mı?") &&
          baslat(async () => {
            const r = await tumCihazlardanCik().catch(() => ({ hata: "Bağlantı hatası. Tekrar dene." }));
            setSonuc(r?.hata ?? "Diğer cihazlardaki oturumlar kapandı.");
          })
        }
        className="sf-ikincil-dugme w-full !min-h-11"
      >
        {bekliyor ? "Kapatılıyor…" : "Diğer cihazlardan çık"}
      </button>
      {sonuc && (
        <p role="status" className="px-1 text-center text-[13px] font-semibold text-[#3730a3]">
          {sonuc}
        </p>
      )}
    </div>
  );
}
