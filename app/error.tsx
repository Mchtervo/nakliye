"use client";

import Link from "next/link";
import { useEffect } from "react";
import { anaYazi } from "@/components/ana/yazi";

/**
 * Sayfa hatası: önceden hiçbir hata ekranı yoktu; Next.js'in hazır sayfası
 * koyu modda simsiyah görünüyordu ("ekran karardı"). Kayıtlar kaybolmaz.
 */
export default function Hata({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[sayfa hatası]", error);
  }, [error]);

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <div className="ana-ic flex min-h-[70dvh] flex-col items-center justify-center gap-4 py-10 text-center">
        <p className="text-[2.4rem]" aria-hidden>
          ⚠️
        </p>
        <h1 className="text-[1.4rem] font-extrabold">Sayfa açılamadı</h1>
        <p className="max-w-xs text-[14.5px] text-[var(--a-ikincil)]">
          Bağlantı yavaş olabilir. Kaydettiğin bilgiler duruyor; tekrar dene.
        </p>
        <button type="button" onClick={() => reset()} className="ana-ana-dugme w-full max-w-xs">
          Tekrar dene
        </button>
        <Link href="/" className="text-[14px] font-bold text-[var(--a-indigo)]">
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
