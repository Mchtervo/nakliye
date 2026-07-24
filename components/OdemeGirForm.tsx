"use client";

import { useActionState, useMemo, useState } from "react";
import { yukOdemeEkle, type FormSonuc } from "@/app/actions";
import { tlKurusaCevir, tlGirisBicimle, tlYaz } from "@/lib/para";

function bugun(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Anlaşılan tutardan düşerek ödeme girişi.
 * Kullanıcı "ne kadar ödedi" yazar → kalan canlı hesaplanır.
 */
export default function OdemeGirForm({
  yukId,
  anlasilanKurus,
  odenenKurus,
}: {
  yukId: number;
  anlasilanKurus: number;
  odenenKurus: number;
}) {
  const kalanBaslangic = Math.max(0, anlasilanKurus - odenenKurus);
  const [acik, setAcik] = useState(false);
  const [girilen, setGirilen] = useState("");

  const [durum, aksiyon, bekliyor] = useActionState<FormSonuc, FormData>(
    async (onceki, fd) => {
      const sonuc = await yukOdemeEkle(onceki, fd);
      if (!sonuc?.hata) {
        setAcik(false);
        setGirilen("");
      }
      return sonuc;
    },
    null
  );

  const girilenKurus = tlKurusaCevir(girilen);
  const onizleme = useMemo(() => {
    if (girilenKurus === null || girilenKurus <= 0) return null;
    if (girilenKurus > kalanBaslangic) {
      return { hata: true, kalan: kalanBaslangic - girilenKurus };
    }
    return { hata: false, kalan: kalanBaslangic - girilenKurus };
  }, [girilenKurus, kalanBaslangic]);

  if (kalanBaslangic <= 0) return null;

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="rounded-lg border border-amber/40 px-2.5 py-1.5 text-sm font-semibold text-amber transition-colors hover:bg-amber/10"
      >
        Ödeme Gir
      </button>
    );
  }

  return (
    <form
      action={aksiyon}
      className="w-full space-y-3 rounded-xl border border-amber/30 bg-asphalt/50 p-3"
    >
      <input type="hidden" name="yukId" value={yukId} />

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="font-bold uppercase tracking-wider text-fog">Anlaşılan</div>
          <div className="mt-0.5 font-display text-sm font-bold text-paper">
            {tlYaz(anlasilanKurus)}
          </div>
        </div>
        <div>
          <div className="font-bold uppercase tracking-wider text-fog">Ödenen</div>
          <div className="mt-0.5 font-display text-sm font-bold text-ok">
            {tlYaz(odenenKurus)}
          </div>
        </div>
        <div>
          <div className="font-bold uppercase tracking-wider text-fog">Kalan</div>
          <div className="mt-0.5 font-display text-sm font-bold text-amber">
            {tlYaz(kalanBaslangic)}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`odeme-${yukId}`} className="etiket !text-fog">
          Ne kadar ödedi? (TL)
        </label>
        <input
          id={`odeme-${yukId}`}
          name="tutar"
          type="text"
          inputMode="decimal"
          required
          placeholder={`En fazla ${tlYaz(kalanBaslangic)}`}
          value={girilen}
          onChange={(e) => setGirilen(tlGirisBicimle(e.target.value))}
          className="alan !py-2.5 font-display text-lg font-bold"
        />
      </div>

      {onizleme && !onizleme.hata && (
        <div className="rounded-lg bg-ok/10 px-3 py-2 text-sm font-semibold text-ok">
          Bu ödemeden sonra kalan: {tlYaz(onizleme.kalan)}
          {onizleme.kalan === 0 ? " — tamamı kapanır" : ""}
        </div>
      )}
      {onizleme?.hata && (
        <div className="rounded-lg bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          Kalan alacak {tlYaz(kalanBaslangic)}. Daha fazla giremezsin.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="etiket !text-fog">Tarih</label>
          <input
            name="tarih"
            type="date"
            required
            defaultValue={bugun()}
            className="alan !py-2 text-sm"
          />
        </div>
        <div>
          <label className="etiket !text-fog">Not</label>
          <input
            name="not"
            type="text"
            placeholder="İsteğe bağlı"
            className="alan !py-2 text-sm"
          />
        </div>
      </div>

      {durum?.hata && (
        <p className="text-xs font-semibold text-ember">{durum.hata}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={bekliyor} className="btn btn-amber !py-2 text-sm">
          {bekliyor ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAcik(false);
            setGirilen("");
          }}
          className="btn btn-ghost !py-2 text-sm"
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
