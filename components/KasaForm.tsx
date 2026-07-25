"use client";

import { useActionState, useState } from "react";
import { kasaHareketEkle, type FormSonuc } from "@/app/actions";
import { tlGirisBicimle, tlKurusaCevir, tlYaz } from "@/lib/para";

export default function KasaForm({ bugunTarih }: { bugunTarih: string }) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    kasaHareketEkle,
    null
  );
  const [tip, setTip] = useState<"GIRIS" | "CIKIS">("GIRIS");
  const [tutar, setTutar] = useState("");
  const kurus = tlKurusaCevir(tutar);

  return (
    <form action={aksiyon} className="space-y-4">
      <div>
        <label htmlFor="tarih" className="etiket">
          Tarih
        </label>
        <input
          id="tarih"
          name="tarih"
          type="date"
          required
          defaultValue={bugunTarih}
          className="alan"
        />
      </div>

      <input type="hidden" name="tip" value={tip} />
      <div>
        <span className="etiket">İşlem</span>
        <div className="secenek-grup">
          <button
            type="button"
            className={`secenek ${tip === "GIRIS" ? "aktif" : ""}`}
            onClick={() => setTip("GIRIS")}
          >
            Kasaya giriş (+)
          </button>
          <button
            type="button"
            className={`secenek ${tip === "CIKIS" ? "aktif" : ""}`}
            onClick={() => setTip("CIKIS")}
          >
            Kasadan çıkış (−)
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="tutar" className="etiket">
          Tutar (TL)
        </label>
        <input
          id="tutar"
          name="tutar"
          type="text"
          inputMode="decimal"
          required
          placeholder="Örnek: 5.000"
          value={tutar}
          onChange={(e) => setTutar(tlGirisBicimle(e.target.value))}
          className="alan font-display text-xl font-bold"
        />
        {kurus !== null && kurus > 0 && (
          <p className="mt-1 text-sm font-semibold text-amber">{tlYaz(kurus)}</p>
        )}
      </div>

      <div>
        <label htmlFor="aciklama" className="etiket">
          Açıklama
        </label>
        <input
          id="aciklama"
          name="aciklama"
          type="text"
          placeholder={
            tip === "GIRIS"
              ? "Örnek: Firma nakit ödeme / avans"
              : "Örnek: Cepten yakıt / harcama"
          }
          className="alan"
        />
      </div>

      {durum?.hata && (
        <p className="text-sm font-semibold text-ember">{durum.hata}</p>
      )}

      <button
        type="submit"
        disabled={bekliyor}
        className={`btn btn-block ${tip === "GIRIS" ? "btn-teal" : "btn-amber"}`}
      >
        {bekliyor
          ? "Kaydediliyor..."
          : tip === "GIRIS"
            ? "Kasaya Ekle"
            : "Kasadan Düş"}
      </button>
    </form>
  );
}
