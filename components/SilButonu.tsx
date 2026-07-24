"use client";

import { useTransition } from "react";

export default function SilButonu({
  onay,
  sil,
}: {
  onay: string;
  sil: () => Promise<void>;
}) {
  const [bekliyor, baslat] = useTransition();

  return (
    <button
      type="button"
      disabled={bekliyor}
      onClick={() => {
        if (window.confirm(onay)) {
          baslat(async () => {
            await sil();
          });
        }
      }}
      className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ember/90 transition-colors hover:bg-ember/10 disabled:opacity-50"
      title="Sil"
    >
      Sil
    </button>
  );
}
