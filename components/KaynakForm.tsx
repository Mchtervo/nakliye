"use client";

import { useActionState, useState } from "react";
import { kaynakEkle, type AiSonuc } from "@/app/ai-actions";

export default function KaynakForm() {
  const [durum, aksiyon, bekliyor] = useActionState<AiSonuc, FormData>(
    kaynakEkle,
    null
  );
  const [tur, setTur] = useState<"WEB" | "AI_ARAMA">("WEB");

  return (
    <form action={aksiyon} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTur("WEB")}
          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
            tur === "WEB"
              ? "border-amber/45 bg-amber/12 text-amber"
              : "border-white/12 bg-white/4 text-fog hover:text-paper"
          }`}
        >
          İlan sitesi
        </button>
        <button
          type="button"
          onClick={() => setTur("AI_ARAMA")}
          className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
            tur === "AI_ARAMA"
              ? "border-amber/45 bg-amber/12 text-amber"
              : "border-white/12 bg-white/4 text-fog hover:text-paper"
          }`}
        >
          AI araması
        </button>
      </div>
      <input type="hidden" name="tur" value={tur} />

      <div>
        <label htmlFor="hedef" className="etiket">
          {tur === "WEB" ? "Sayfa adresi" : "Arama sorgusu"}
        </label>
        <input
          id="hedef"
          name="hedef"
          type="text"
          required
          placeholder={
            tur === "WEB"
              ? "https://ornek-yuk-sitesi.com/ilanlar"
              : "Ankara çıkışlı yük ilanı"
          }
          className="alan"
        />
        <p className="mt-1 text-xs text-fog">
          {tur === "WEB"
            ? "Giriş (login) isteyen sayfalar taranamaz."
            : "Yapay zekâ bu sorguyu internette arar, bulduğu ilanları çözümler."}
        </p>
      </div>

      <div>
        <label htmlFor="ad" className="etiket">
          Kısa ad (isteğe bağlı)
        </label>
        <input
          id="ad"
          name="ad"
          type="text"
          placeholder={tur === "WEB" ? "Örnek: Yük Pazarı" : "Örnek: Ankara çıkış"}
          className="alan"
        />
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

      <button type="submit" disabled={bekliyor} className="btn btn-ghost btn-block">
        {bekliyor ? "Ekleniyor..." : "Kaynak Ekle"}
      </button>
    </form>
  );
}
