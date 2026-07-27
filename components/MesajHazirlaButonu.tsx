"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ilanIletisimeGecildi,
  ilanMesajHazirla,
} from "@/app/ai-actions";
import { whatsappMesajUrl } from "@/lib/whatsapp";

export default function MesajHazirlaButonu({
  ilanId,
  telefon,
}: {
  ilanId: number;
  telefon: string;
}) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [acik, setAcik] = useState(false);
  const [metin, setMetin] = useState("");
  const [cache, setCache] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function uret() {
    setHata(null);
    baslat(async () => {
      const r = await ilanMesajHazirla(ilanId);
      if (!r.ok) {
        setHata(r.hata);
        setAcik(true);
        return;
      }
      setMetin(r.metin);
      setCache(r.cache);
      setAcik(true);
    });
  }

  async function iletisimIsaretle() {
    await ilanIletisimeGecildi(ilanId);
    router.refresh();
  }

  function kopyala() {
    baslat(async () => {
      try {
        await navigator.clipboard.writeText(metin);
      } catch {
        /* ignore */
      }
      await iletisimIsaretle();
    });
  }

  function whatsappAc() {
    const url = whatsappMesajUrl(telefon, metin);
    if (!url) return;
    baslat(async () => {
      await iletisimIsaretle();
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={bekliyor}
        onClick={uret}
        className="rounded-lg border border-teal/40 bg-teal/15 px-2.5 py-1.5 text-xs font-semibold text-teal transition-colors hover:bg-teal/25 disabled:opacity-50"
      >
        {bekliyor && !acik ? "Hazırlanıyor…" : "Mesaj Hazırla"}
      </button>

      {acik && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setAcik(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#1a1f2e] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-paper">
                WhatsApp mesajı
              </h3>
              <button
                type="button"
                onClick={() => setAcik(false)}
                className="text-xs font-semibold text-fog hover:text-paper"
              >
                Kapat
              </button>
            </div>

            {hata ? (
              <p className="text-sm font-semibold text-ember">{hata}</p>
            ) : (
              <>
                {cache && (
                  <p className="mb-2 text-[11px] text-fog">
                    Kayıtlı mesaj (24s) — yeniden üretilmedi
                  </p>
                )}
                <textarea
                  value={metin}
                  onChange={(e) => setMetin(e.target.value)}
                  rows={8}
                  className="alan w-full text-sm leading-relaxed"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={bekliyor || !metin.trim()}
                    onClick={whatsappAc}
                    className="btn btn-teal !px-3 !py-1.5 text-xs disabled:opacity-50"
                  >
                    WhatsApp&apos;ta Aç
                  </button>
                  <button
                    type="button"
                    disabled={bekliyor || !metin.trim()}
                    onClick={kopyala}
                    className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-paper hover:border-amber/40 hover:text-amber disabled:opacity-50"
                  >
                    Kopyala
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
