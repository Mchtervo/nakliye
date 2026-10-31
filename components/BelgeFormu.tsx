"use client";

import { useActionState, useEffect, useState } from "react";
import { belgeKaydet, belgeSil, type BelgeSonuc } from "@/app/actions";
import { BELGE_TURLERI } from "@/lib/belge";

const BASLANGIC: BelgeSonuc = { hata: null, tamam: false };

/** Yeni belge: tür + (diğer ise ad) + bitiş tarihi. */
export function BelgeEkle({ ilkAcik }: { ilkAcik: boolean }) {
  const [acik, setAcik] = useState(ilkAcik);
  const [tur, setTur] = useState<string>("MUAYENE");
  const [durum, gonder, bekliyor] = useActionState(belgeKaydet, BASLANGIC);

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="text-sm font-semibold text-amber">
        + Belge ekle
      </button>
    );
  }
  return (
    <form action={gonder} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="belge-tur" className="etiket">
            Belge
          </label>
          <select id="belge-tur" name="tur" value={tur} onChange={(e) => setTur(e.target.value)} className="alan">
            {BELGE_TURLERI.map((t) => (
              <option key={t.kod} value={t.kod}>
                {t.ad}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="belge-bitis" className="etiket">
            Bitiş tarihi
          </label>
          <input id="belge-bitis" name="bitis" type="date" required className="alan" />
        </div>
      </div>
      {tur === "DIGER" && (
        <input name="ad" placeholder="Belgenin adı (örn. ADR belgesi)" className="alan" autoComplete="off" />
      )}
      {durum.hata && <p className="text-sm font-semibold text-ember">{durum.hata}</p>}
      <button type="submit" disabled={bekliyor} className="btn btn-amber w-full disabled:opacity-60">
        {bekliyor ? "Kaydediliyor…" : "Belgeyi ekle"}
      </button>
    </form>
  );
}

/** Satır: "Yenilendi" → yeni bitiş tarihi; Sil. */
export function BelgeSatirIslem({ id, bitis }: { id: number; bitis: string }) {
  const [acik, setAcik] = useState(false);
  const [durum, gonder, bekliyor] = useActionState(belgeKaydet, BASLANGIC);
  const [siliniyor, setSiliniyor] = useState(false);

  // Kaydedilince kapan
  useEffect(() => {
    if (durum.tamam) {
      const t = setTimeout(() => setAcik(false), 0);
      return () => clearTimeout(t);
    }
  }, [durum]);

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-paper hover:bg-white/5"
      >
        Yenilendi
      </button>
    );
  }
  return (
    <form action={gonder} className="flex w-full flex-wrap items-center gap-2 pt-2">
      <input type="hidden" name="belgeId" value={id} />
      <input name="bitis" type="date" required defaultValue={bitis} className="alan min-w-0 flex-1 !py-2" aria-label="Yeni bitiş tarihi" />
      <button type="submit" disabled={bekliyor} className="btn btn-amber !min-h-9 !px-3 text-sm disabled:opacity-60">
        Kaydet
      </button>
      <button
        type="button"
        disabled={siliniyor}
        onClick={async () => {
          if (!window.confirm("Bu belge silinsin mi?")) return;
          setSiliniyor(true);
          await belgeSil(id);
        }}
        className="text-sm font-semibold text-ember"
      >
        Sil
      </button>
      {durum.hata && <p className="w-full text-sm font-semibold text-ember">{durum.hata}</p>}
    </form>
  );
}
