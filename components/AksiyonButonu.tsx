"use client";

import { useTransition } from "react";

/** Server action'ı tetikleyen, bekleme durumunu gösteren buton. */
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

  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => {
        if (onay && !window.confirm(onay)) return;
        baslat(async () => {
          await calistir();
        });
      }}
      className={`${sinif} disabled:opacity-60`}
    >
      {bekliyor ? bekleyenEtiket : etiket}
    </button>
  );
}
