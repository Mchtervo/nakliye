"use client";

import { useState, useTransition } from "react";
import {
  testBildirimGonder,
  testPushGonder,
  type AiSonuc,
} from "@/app/ai-actions";

/** Ayarlar: Telegram + Push bildirim yollarını doğrula. */
export default function TestBildirimButonu() {
  const [bekliyor, baslat] = useTransition();
  const [tgSonuc, setTgSonuc] = useState<AiSonuc>(null);
  const [pushSonuc, setPushSonuc] = useState<AiSonuc>(null);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-3">
      <div>
        <h3 className="text-sm font-bold text-paper">Test bildirimi</h3>
        <p className="text-xs text-fog">
          Telegram ve telefon push yollarını ayrı ayrı dene.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => {
            baslat(async () => {
              setTgSonuc(null);
              setTgSonuc(await testBildirimGonder());
            });
          }}
          className="rounded-lg border border-ok/30 px-3 py-2 text-xs font-semibold text-ok hover:bg-ok/10 disabled:opacity-60"
        >
          {bekliyor ? "…" : "Test Telegram"}
        </button>
        <button
          type="button"
          disabled={bekliyor}
          onClick={() => {
            baslat(async () => {
              setPushSonuc(null);
              setPushSonuc(await testPushGonder());
            });
          }}
          className="rounded-lg border border-teal/40 px-3 py-2 text-xs font-semibold text-teal hover:bg-teal/10 disabled:opacity-60"
        >
          {bekliyor ? "…" : "Test push gönder"}
        </button>
      </div>

      {tgSonuc && "hata" in tgSonuc && (
        <p className="text-xs text-ember">TG: {tgSonuc.hata}</p>
      )}
      {tgSonuc && "bilgi" in tgSonuc && (
        <p className="text-xs text-ok">TG: {tgSonuc.bilgi}</p>
      )}
      {pushSonuc && "hata" in pushSonuc && (
        <p className="text-xs text-ember">Push: {pushSonuc.hata}</p>
      )}
      {pushSonuc && "bilgi" in pushSonuc && (
        <p className="text-xs text-ok">Push: {pushSonuc.bilgi}</p>
      )}
    </div>
  );
}
