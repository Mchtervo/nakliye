"use client";

import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Sunucu işlemi düğmesi: sürerken kilitli (çift dokunma çift kayıt yapmaz),
 * bitince kısa "✓", hata olursa açıklayıcı mesaj.
 */
export default function AksiyonButonu({
  calistir,
  etiket,
  bekleyenEtiket = "Çalışıyor...",
  onay,
  sinif = "btn btn-ghost !px-3 !py-2 text-xs sm:text-sm",
}: {
  calistir: () => Promise<void>;
  etiket: string;
  bekleyenEtiket?: string;
  onay?: string;
  sinif?: string;
}) {
  const [bekliyor, baslat] = useTransition();
  const [sonuc, setSonuc] = useState<"tamam" | "hata" | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const zaman = useRef<number | null>(null);

  useEffect(() => () => {
    if (zaman.current) window.clearTimeout(zaman.current);
  }, []);

  function goster(s: "tamam" | "hata", sure: number) {
    setSonuc(s);
    if (zaman.current) window.clearTimeout(zaman.current);
    zaman.current = window.setTimeout(() => {
      setSonuc(null);
      setHata(null);
    }, sure);
  }

  return (
    <>
      <button
        type="button"
        disabled={bekliyor}
        aria-busy={bekliyor}
        title={sonuc === "hata" && hata ? hata : undefined}
        onClick={() => {
          if (bekliyor) return;
          if (onay && !window.confirm(onay)) return;
          setHata(null);
          baslat(async () => {
            try {
              await calistir();
              goster("tamam", 1400);
            } catch (e) {
              setHata(e instanceof Error && e.message ? e.message : "İşlem yapılamadı.");
              goster("hata", 4000);
            }
          });
        }}
        className={`${sinif} disabled:opacity-60`}
      >
        {bekliyor ? bekleyenEtiket : sonuc === "tamam" ? "✓ Tamam" : sonuc === "hata" ? "Olmadı · tekrar dene" : etiket}
      </button>
      {sonuc === "hata" && hata && (
        <span role="alert" className="sr-only">
          {hata}
        </span>
      )}
    </>
  );
}
