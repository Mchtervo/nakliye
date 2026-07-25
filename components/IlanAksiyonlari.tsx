"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ilanDurumGuncelle, ilanSil } from "@/app/ai-actions";

export type IlanOzeti = {
  id: number;
  durum: string;
  nereden: string | null;
  nereye: string | null;
  firmaAdi: string | null;
  telefon: string | null;
  ucretYazi: string | null;
};

export default function IlanAksiyonlari({ ilan }: { ilan: IlanOzeti }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();

  function yukeCevir() {
    const p = new URLSearchParams();
    if (ilan.nereden) p.set("nereden", ilan.nereden);
    if (ilan.nereye) p.set("nereye", ilan.nereye);
    if (ilan.firmaAdi) p.set("firma", ilan.firmaAdi);
    if (ilan.ucretYazi) p.set("tutar", ilan.ucretYazi);

    baslat(async () => {
      await ilanDurumGuncelle(ilan.id, "YUKE_DONDU");
      router.push(`/yukler/yeni?${p.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ilan.telefon && (
        <a
          href={`tel:${ilan.telefon}`}
          className="btn btn-teal !px-3 !py-1.5 text-xs"
        >
          Ara
        </a>
      )}

      <button
        type="button"
        disabled={bekliyor}
        onClick={yukeCevir}
        className="btn btn-amber !px-3 !py-1.5 text-xs disabled:opacity-50"
      >
        Yüke çevir
      </button>

      {ilan.durum !== "ILGILENIYOR" && (
        <button
          type="button"
          disabled={bekliyor}
          onClick={() =>
            baslat(async () => {
              await ilanDurumGuncelle(ilan.id, "ILGILENIYOR");
            })
          }
          className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-paper transition-colors hover:border-amber/40 hover:text-amber disabled:opacity-50"
        >
          Takibe al
        </button>
      )}

      {ilan.durum !== "ELENDI" && (
        <button
          type="button"
          disabled={bekliyor}
          onClick={() =>
            baslat(async () => {
              await ilanDurumGuncelle(ilan.id, "ELENDI");
            })
          }
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fog transition-colors hover:bg-white/5 hover:text-paper disabled:opacity-50"
        >
          İlgilenmiyorum
        </button>
      )}

      <button
        type="button"
        disabled={bekliyor}
        onClick={() => {
          if (!window.confirm("Bu ilanı silmek istediğine emin misin?")) return;
          baslat(async () => {
            await ilanSil(ilan.id);
          });
        }}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ember/90 transition-colors hover:bg-ember/10 disabled:opacity-50"
      >
        Sil
      </button>
    </div>
  );
}
