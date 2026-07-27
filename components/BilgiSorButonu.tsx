"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ilanBilgiSor } from "@/app/ai-actions";

/** Tek tuş: Telegram DM kuyruk veya WhatsApp link — modal yok. */
export default function BilgiSorButonu({
  ilanId,
  gonderenUserId,
  telefon,
}: {
  ilanId: number;
  gonderenUserId?: string | null;
  telefon?: string | null;
}) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [bilgi, setBilgi] = useState<string | null>(null);

  if (!gonderenUserId && !telefon) return null;

  function bas() {
    setBilgi(null);
    baslat(async () => {
      const r = await ilanBilgiSor(ilanId);
      setBilgi(r.mesaj);
      if (r.ok && r.kanal === "whatsapp" && r.waUrl) {
        window.open(r.waUrl, "_blank", "noopener,noreferrer");
      }
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={bekliyor}
        onClick={bas}
        className="rounded-lg border border-sky-400/50 bg-sky-500/20 px-2.5 py-1.5 text-xs font-bold text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition-colors hover:bg-sky-500/35 disabled:opacity-50"
      >
        {bekliyor ? "…" : "Bilgi Sor"}
      </button>
      {bilgi && (
        <span className="max-w-[14rem] text-[10px] leading-snug text-fog">
          {bilgi}
        </span>
      )}
    </div>
  );
}
