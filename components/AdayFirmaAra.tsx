"use client";

import { useActionState } from "react";
import { adayFirmaAra, type AiSonuc } from "@/app/ai-actions";

export default function AdayFirmaAra({ sehir }: { sehir: string | null }) {
  const [durum, aksiyon, bekliyor] = useActionState<AiSonuc, FormData>(
    adayFirmaAra,
    null
  );

  return (
    <form action={aksiyon} className="kart space-y-3 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-paper">
          Yeni müşteri ara
        </h2>
        <p className="text-xs text-fog">
          Şehri yaz, yapay zekâ o bölgedeki fabrika ve üreticileri taransın.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sehir" className="etiket">
            Şehir
          </label>
          <input
            id="sehir"
            name="sehir"
            type="text"
            required
            placeholder="Örnek: Ankara"
            defaultValue={sehir || ""}
            className="alan"
          />
        </div>
        <div>
          <label htmlFor="sektor" className="etiket">
            Sektör (isteğe bağlı)
          </label>
          <input
            id="sektor"
            name="sektor"
            type="text"
            placeholder="Örnek: mobilya, demir çelik"
            className="alan"
          />
        </div>
      </div>

      {durum && "hata" in durum && (
        <div className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm font-semibold text-ember">
          {durum.hata}
        </div>
      )}
      {durum && "bilgi" in durum && (
        <div className="rounded-xl border border-ok/30 bg-ok/10 px-3 py-2.5 text-sm font-semibold text-ok">
          {durum.bilgi}
        </div>
      )}

      <button type="submit" disabled={bekliyor} className="btn btn-amber btn-block">
        {bekliyor ? "Aranıyor (1-2 dk sürebilir)..." : "Firma ara"}
      </button>
    </form>
  );
}
