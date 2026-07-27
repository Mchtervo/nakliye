"use client";

import { useState, useTransition } from "react";
import { ilanBilgiSor } from "@/app/ai-actions";

/** Tek tuş: Telegram DM kuyruk veya WhatsApp — her durumda görünür geri bildirim. */
export default function BilgiSorButonu({
  ilanId,
  gonderenUserId,
  telefon,
}: {
  ilanId: number;
  gonderenUserId?: string | null;
  telefon?: string | null;
}) {
  const [bekliyor, baslat] = useTransition();
  const [toast, setToast] = useState<{
    metin: string;
    ok: boolean;
    waUrl?: string;
  } | null>(null);

  function goster(
    metin: string,
    ok: boolean,
    waUrl?: string
  ) {
    setToast({ metin, ok, waUrl });
    // 8 sn sonra soluklaşsın (refresh ile silinmesin diye router.refresh yok)
    window.setTimeout(() => {
      setToast((t) => (t?.metin === metin ? null : t));
    }, 8000);
  }

  function bas() {
    console.log("[BilgiSor] tık", {
      ilanId,
      gonderenUserId: gonderenUserId || null,
      telefon: telefon || null,
    });

    if (!gonderenUserId && !telefon) {
      goster("İletişim bilgisi bulunamadı", false);
      return;
    }

    baslat(async () => {
      try {
        const r = await ilanBilgiSor(ilanId);
        console.log("[BilgiSor] cevap", r);

        if (!r.ok) {
          goster(r.mesaj || "İşlem başarısız", false);
          return;
        }

        if (r.kanal === "whatsapp" && r.waUrl) {
          goster(r.mesaj, true, r.waUrl);
          // Async sonrası popup engeli olabilir — link toast'ta da duruyor
          const acilan = window.open(r.waUrl, "_blank", "noopener,noreferrer");
          if (!acilan) {
            console.warn("[BilgiSor] window.open engellendi — toast linkini kullan");
          }
          return;
        }

        goster(r.mesaj || "✅ Gönderildi", true);
      } catch (e) {
        const mesaj =
          e instanceof Error ? e.message : "Sunucu hatası / action bulunamadı";
        console.error("[BilgiSor] hata", e);
        goster(mesaj, false);
      }
    });
  }

  return (
    <div className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={bekliyor}
        onClick={bas}
        className="rounded-lg border border-sky-400/50 bg-sky-500/20 px-2.5 py-1.5 text-xs font-bold text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] transition-colors hover:bg-sky-500/35 disabled:opacity-50"
      >
        {bekliyor ? "Gönderiliyor…" : "Bilgi Sor"}
      </button>

      {toast && (
        <div
          role="status"
          className={`z-20 mt-1 max-w-[18rem] rounded-lg border px-2.5 py-2 text-xs font-semibold leading-snug shadow-lg ${
            toast.ok
              ? "border-teal/40 bg-teal/20 text-teal"
              : "border-ember/40 bg-ember/15 text-ember"
          }`}
        >
          <div>{toast.metin}</div>
          {toast.waUrl && (
            <a
              href={toast.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block underline underline-offset-2"
            >
              WhatsApp&apos;ı aç →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
