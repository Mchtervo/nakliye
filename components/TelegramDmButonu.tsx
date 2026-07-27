"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ilanTelegramDmGonder } from "@/app/ai-actions";

export default function TelegramDmButonu({ ilanId }: { ilanId: number }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [bilgi, setBilgi] = useState<string | null>(null);

  function gonder() {
    setBilgi(null);
    baslat(async () => {
      const r = await ilanTelegramDmGonder(ilanId);
      setBilgi(r.mesaj);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={bekliyor}
        onClick={gonder}
        className="rounded-lg border border-sky-400/50 bg-sky-500/20 px-2.5 py-1.5 text-xs font-bold text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition-colors hover:bg-sky-500/35 disabled:opacity-50"
      >
        {bekliyor ? "Kuyruğa…" : "Telegram DM"}
      </button>
      {bilgi && (
        <span className="max-w-[14rem] text-[10px] leading-snug text-fog">
          {bilgi}
        </span>
      )}
    </div>
  );
}
