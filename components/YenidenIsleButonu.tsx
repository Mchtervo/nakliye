"use client";

import { useState, useTransition } from "react";
import { eskiHamMesajlariYenidenIsle, type AiSonuc } from "@/app/ai-actions";

/** Bölge/araç ayarı değişince eski ham mesajları yeniden kuyruğa alır. */
export default function YenidenIsleButonu() {
  const [bekliyor, baslat] = useTransition();
  const [sonuc, setSonuc] = useState<AiSonuc>(null);

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/4 p-3">
      <div>
        <h3 className="text-sm font-bold text-paper">
          Eski ham mesajları yeniden işle
        </h3>
        <p className="text-xs text-fog">
          Bölge veya araç ayarını genişlettiysen son 7 günün ham mesajlarını
          tekrar kuyruğa alır. OpenAI çağrısı bu butonda yapılmaz.
        </p>
      </div>
      <button
        type="button"
        disabled={bekliyor}
        onClick={() => {
          if (
            !window.confirm(
              "Son 7 günün işlenmiş ham mesajları yeniden kuyruğa alınacak. Devam?"
            )
          ) {
            return;
          }
          baslat(async () => {
            setSonuc(await eskiHamMesajlariYenidenIsle());
          });
        }}
        className="btn btn-ghost !px-3 !py-2 text-xs sm:text-sm disabled:opacity-60"
      >
        {bekliyor ? "Kuyruğa alınıyor..." : "Yeniden işle"}
      </button>
      {sonuc && "hata" in sonuc && (
        <p className="text-sm font-semibold text-ember">{sonuc.hata}</p>
      )}
      {sonuc && "bilgi" in sonuc && (
        <p className="text-sm font-semibold text-ok">{sonuc.bilgi}</p>
      )}
    </div>
  );
}
