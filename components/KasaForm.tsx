"use client";

import { m } from "motion/react";
import { useActionState, useState } from "react";
import { kasaHareketEkle, type FormSonuc } from "@/app/actions";
import { tlGirisBicimle } from "@/lib/para";

const YONLER = [
  { kod: "GIRIS", ad: "Giriş", ok: "M12 19V5M5 12l7-7 7 7", renk: "#16a34a", zemin: "bg-[#dcfce7]" },
  { kod: "CIKIS", ad: "Çıkış", ok: "M12 5v14M5 12l7 7 7-7", renk: "#dc2626", zemin: "bg-[#fee2e2]" },
] as const;

/** Kasaya elle nakit giriş / çıkış (gelir-gider hesabına girmez, yalnız kasa bakiyesi). */
export default function KasaForm({ bugunTarih }: { bugunTarih: string }) {
  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(kasaHareketEkle, null);
  const [tip, setTip] = useState<"GIRIS" | "CIKIS">("GIRIS");
  const [tutar, setTutar] = useState("");

  return (
    <form action={aksiyon} className="space-y-3">
      <input type="hidden" name="tip" value={tip} />
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="İşlem yönü">
        {YONLER.map((y) => {
          const secili = tip === y.kod;
          return (
            <button
              key={y.kod}
              type="button"
              aria-pressed={secili}
              onClick={() => setTip(y.kod)}
              className={`ks-yon relative ${secili ? "" : "opacity-60"}`}
              style={{ color: y.renk }}
            >
              {secili && (
                <m.span
                  layoutId="kasa-yon"
                  className={`absolute inset-0 rounded-[1rem] ${y.zemin}`}
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                  aria-hidden
                />
              )}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="relative h-5 w-5" aria-hidden>
                <path d={y.ok} />
              </svg>
              <span className="relative">{y.ad}</span>
            </button>
          );
        })}
      </div>

      <div className="ks-satir">
        <label htmlFor="kasa-tarih" className="gd-satir-etiket">
          Tarih
        </label>
        <div className="sf-alan">
          <input id="kasa-tarih" name="tarih" type="date" required defaultValue={bugunTarih} className="sf-girdi" />
        </div>
      </div>
      <div className="ks-satir">
        <label htmlFor="kasa-tutar" className="gd-satir-etiket">
          Tutar
        </label>
        <div className="sf-alan">
          <span className="font-bold text-[var(--a-ikincil)]" aria-hidden>
            ₺
          </span>
          <input
            id="kasa-tutar"
            name="tutar"
            type="text"
            inputMode="decimal"
            required
            placeholder="0"
            value={tutar}
            onChange={(e) => setTutar(tlGirisBicimle(e.target.value))}
            className="sf-girdi !font-bold tabular-nums"
          />
        </div>
      </div>
      <div className="ks-satir">
        <label htmlFor="kasa-aciklama" className="gd-satir-etiket">
          Açıklama
        </label>
        <div className="sf-alan">
          <input
            id="kasa-aciklama"
            name="aciklama"
            type="text"
            placeholder={tip === "GIRIS" ? "Örn. nakit giriş, avans" : "Örn. cepten yakıt, harcama"}
            className="sf-girdi"
          />
        </div>
      </div>

      {durum?.hata && (
        <p role="alert" className="rounded-2xl bg-[#fee2e2] px-3 py-2.5 text-[13px] font-semibold text-[#b91c1c]">
          {durum.hata}
        </p>
      )}

      <button type="submit" disabled={bekliyor} className="ana-ana-dugme w-full !min-h-12 !text-[15px] disabled:opacity-60">
        {bekliyor ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            Kaydediliyor…
          </>
        ) : tip === "GIRIS" ? (
          "Kasaya ekle"
        ) : (
          "Kasadan düş"
        )}
      </button>
      <p className="text-center text-[11.5px] text-[var(--a-ikincil)]">
        Firma tahsilatını carideki seferden gir; kasa yalnız elindeki nakdi izler, gelir sayılmaz.
      </p>
    </form>
  );
}
