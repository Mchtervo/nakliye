"use client";

import { useState, useTransition } from "react";
import { testBildirimGonder, type AiSonuc } from "@/app/ai-actions";

/** Ayarlar: Telegram bildirim yolunu doğrula. */
export default function TestBildirimButonu() {
  const [bekliyor, baslat] = useTransition();
  const [sonuc, setSonuc] = useState<AiSonuc>(null);

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/4 p-3">
      <div>
        <h3 className="text-sm font-bold text-paper">Test bildirimi</h3>
        <p className="text-xs text-fog">
          Telegram botuna anında bir mesaj gönderir. Gelmezse sohbeti veya botu
          kontrol et.
        </p>
      </div>
      <button
        type="button"
        disabled={bekliyor}
        onClick={() => {
          baslat(async () => {
            setSonuc(null);
            setSonuc(await testBildirimGonder());
          });
        }}
        className="rounded-lg border border-ok/30 px-3 py-2 text-xs font-semibold text-ok hover:bg-ok/10 disabled:opacity-60"
      >
        {bekliyor ? "Gönderiliyor…" : "Test bildirimi gönder"}
      </button>
      {sonuc && "hata" in sonuc && (
        <p className="text-xs text-ember">{sonuc.hata}</p>
      )}
      {sonuc && "bilgi" in sonuc && (
        <p className="text-xs text-ok">{sonuc.bilgi}</p>
      )}
    </div>
  );
}
