"use client";

import { useActionState, useState, useTransition } from "react";
import {
  musteriIsaretle,
  musteriNotKaydet,
} from "@/app/musteri-actions";
import { telefonGorunum, type MusteriSinif } from "@/lib/musteriHavuz";
import { gecenSure } from "@/lib/ilanGorunum";

function sinifEtiket(s: MusteriSinif): string {
  if (s === "YUK_SAHIBI") return "YÜK SAHİBİ";
  if (s === "KOMISYONCU") return "KOMİSYONCU";
  return "Karışık";
}

export type MusteriKartVeri = {
  telefon: string;
  firmaAdi: string | null;
  sinif: MusteriSinif;
  baskinCikis: string | null;
  baskinYukTipi: string | null;
  baskinGuzergah: string | null;
  haftalikSiklik: number;
  ilanAdet: number;
  koridorDisi: boolean;
  isaretli: boolean;
  sonNot: string | null;
  sonIlan: string; // ISO
};

export default function MusteriKart({ m }: { m: MusteriKartVeri }) {
  const [notAcik, setNotAcik] = useState(false);
  const [isaretli, setIsaretli] = useState(m.isaretli);
  const [bekliyor, baslat] = useTransition();
  const [notDurum, notAksiyon, notBekliyor] = useActionState(
    musteriNotKaydet,
    null
  );

  function isaret() {
    baslat(async () => {
      const r = await musteriIsaretle(m.telefon);
      if (r.ok && typeof r.isaretli === "boolean") setIsaretli(r.isaretli);
    });
  }

  return (
    <article
      className={`rounded-2xl border px-3.5 py-3 ${
        m.sinif === "YUK_SAHIBI"
          ? "border-teal/30 bg-teal/8"
          : m.sinif === "KOMISYONCU"
            ? "border-white/10 bg-white/4 opacity-80"
            : "border-white/10 bg-white/4"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-paper">
            {m.firmaAdi || "İsimsiz"}
            {m.baskinCikis ? (
              <span className="font-normal text-fog"> · {m.baskinCikis}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm font-bold text-teal">
            {telefonGorunum(m.telefon)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              m.sinif === "YUK_SAHIBI"
                ? "bg-teal/20 text-teal"
                : m.sinif === "KOMISYONCU"
                  ? "bg-ember/15 text-ember"
                  : "bg-white/10 text-fog"
            }`}
          >
            {sinifEtiket(m.sinif)}
          </span>
          {m.koridorDisi && (
            <span className="rounded-md bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold text-amber">
              koridor dışı
            </span>
          )}
          {isaretli && (
            <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[10px] font-bold text-ok">
              müşteri
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-fog">
        {m.baskinYukTipi && <p>Yük cinsi: {m.baskinYukTipi}</p>}
        <p>
          Sıklık: haftada ~{m.haftalikSiklik} ilan
          <span className="text-fog/70"> ({m.ilanAdet} / 60g)</span>
        </p>
        {m.baskinGuzergah && <p>Güzergah: {m.baskinGuzergah}</p>}
        <p>Son ilan: {gecenSure(new Date(m.sonIlan))}</p>
        {m.sonNot && (
          <p className="text-paper/80">
            Not: <span className="italic">{m.sonNot}</span>
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <a
          href={`tel:0${m.telefon}`}
          className="flex items-center justify-center rounded-xl bg-teal py-2.5 text-sm font-bold text-asphalt hover:brightness-110"
        >
          Ara
        </a>
        <button
          type="button"
          onClick={() => setNotAcik((v) => !v)}
          className="rounded-xl border border-black/12 bg-white py-2.5 text-sm font-bold text-paper hover:bg-[#f0f5f4]"
        >
          Not
        </button>
        <button
          type="button"
          disabled={bekliyor}
          onClick={isaret}
          className={`rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 ${
            isaretli
              ? "border border-ok/40 bg-ok/15 text-ok"
              : "border border-black/12 bg-white text-paper hover:bg-[#f0f5f4]"
          }`}
        >
          {isaretli ? "İşaretli" : "Müşteri"}
        </button>
      </div>

      {notAcik && (
        <form action={notAksiyon} className="mt-3 space-y-2">
          <input type="hidden" name="telefon" value={m.telefon} />
          <textarea
            name="metin"
            rows={2}
            required
            maxLength={500}
            placeholder="Not ekle…"
            className="w-full rounded-xl border border-black/10 bg-[#f0f5f4] px-3 py-2 text-sm text-ink placeholder:text-black/35 focus:border-teal/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={notBekliyor}
            className="w-full rounded-xl bg-amber py-2 text-sm font-bold text-asphalt disabled:opacity-60"
          >
            {notBekliyor ? "Kaydediliyor…" : "Notu kaydet"}
          </button>
          {notDurum?.hata && (
            <p className="text-xs font-semibold text-ember">{notDurum.hata}</p>
          )}
          {notDurum?.ok && (
            <p className="text-xs font-semibold text-ok">Not kaydedildi</p>
          )}
        </form>
      )}
    </article>
  );
}
