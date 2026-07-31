"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ilanDurumGuncelle, ilanSil } from "@/app/ai-actions";
import BilgiSorButonu from "@/components/BilgiSorButonu";
import { aracBelirsizMi } from "@/lib/arac";
import { beklemeBuyuk } from "@/lib/ilanTazelik";
import { fiyatGorunumu, gecenSure } from "@/lib/ilanGorunum";

export type IlanKartKar = {
  mesafe: string | null;
  yakit: string | null;
  hgs: string | null;
  net: string | null;
  tlKm: string | null;
  uyari: string | null;
  netPozitif?: boolean;
};

export type IlanKartVeri = {
  id: number;
  durum: string;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  tonaj: number | null;
  aracTipi: string | null;
  aracTipiKod: string | null;
  aracUzunluk?: number | null;
  koridorTipi?: string | null;
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz: boolean;
  firmaAdi: string | null;
  telefon: string | null;
  gonderenUserId: string | null;
  guvenSkoru: number;
  hamMetin: string;
  createdAt: Date | string;
  /** Tazelik göstergesi — yoksa createdAt. */
  sonGorulme?: Date | string | null;
  donusTalebiId: number | null;
  kaynakAd: string | null;
  ucretYazi: string | null;
  odakli?: boolean;
  soluk?: boolean;
  vurgulu?: boolean;
  kar?: IlanKartKar | null;
  donusOnerileri?: {
    id: number;
    rota: string;
    fiyat: string | null;
  }[];
};

export default function IlanKart({ ilan }: { ilan: IlanKartVeri }) {
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();
  const [detayAcik, setDetayAcik] = useState(false);
  const [maliyetAcik, setMaliyetAcik] = useState(false);
  const [menuAcik, setMenuAcik] = useState(false);

  const fiyat = fiyatGorunumu(ilan);
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  const createdAt =
    typeof ilan.createdAt === "string"
      ? new Date(ilan.createdAt)
      : ilan.createdAt;
  const tazeTarih = ilan.sonGorulme
    ? typeof ilan.sonGorulme === "string"
      ? new Date(ilan.sonGorulme)
      : ilan.sonGorulme
    : createdAt;
  const iletisimVar = Boolean(ilan.gonderenUserId || ilan.telefon);
  const bekleme = beklemeBuyuk(tazeTarih);
  const karVar = Boolean(ilan.kar && (ilan.kar.mesafe || ilan.kar.net));

  const metaParcalar = [
    ilan.tonaj ? `${ilan.tonaj} ton` : null,
    ilan.aracTipi || null,
  ].filter(Boolean);

  function yukeCevir() {
    const p = new URLSearchParams();
    if (ilan.nereden) p.set("nereden", ilan.nereden);
    if (ilan.nereye) p.set("nereye", ilan.nereye);
    if (ilan.firmaAdi) p.set("firma", ilan.firmaAdi);
    if (ilan.ucretYazi) p.set("tutar", ilan.ucretYazi);
    setMenuAcik(false);
    baslat(async () => {
      await ilanDurumGuncelle(ilan.id, "YUKE_DONDU");
      router.push(`/yukler/yeni?${p.toString()}`);
    });
  }

  function alindiIsaretle() {
    setMenuAcik(false);
    baslat(async () => {
      await ilanDurumGuncelle(ilan.id, "ALINDI");
    });
  }

  return (
    <article
      id={`ilan-${ilan.id}`}
      className={`cam p-4 ${
        ilan.odakli ? "ring-2 ring-amber/40" : ""
      } ${ilan.soluk || ilan.durum === "CEVAP_YOK" ? "opacity-70" : ""}`}
    >
      {/* Üst: süre + menü */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-fog">
          <span className="font-bold text-paper">{bekleme}</span>
          <span> · {gecenSure(tazeTarih)}</span>
        </p>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Diğer işlemler"
            aria-expanded={menuAcik}
            onClick={() => setMenuAcik((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fog hover:bg-white/8 hover:text-paper"
          >
            ⋯
          </button>
          {menuAcik && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Menüyü kapat"
                onClick={() => setMenuAcik(false)}
              />
              <div className="absolute right-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-white/12 bg-[#1a2433] py-1 shadow-xl">
                {ilan.durum !== "ALINDI" && (
                  <button
                    type="button"
                    disabled={bekliyor}
                    onClick={alindiIsaretle}
                    className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-paper hover:bg-white/8 disabled:opacity-50"
                  >
                    Alındı
                  </button>
                )}
                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={yukeCevir}
                  className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-paper hover:bg-white/8 disabled:opacity-50"
                >
                  Sefer yaz
                </button>
                {ilan.durum !== "ILGILENIYOR" &&
                  ilan.durum !== "ILETISIME_GECILDI" &&
                  ilan.durum !== "PAZARLIKTA" && (
                    <button
                      type="button"
                      disabled={bekliyor}
                      onClick={() => {
                        setMenuAcik(false);
                        baslat(async () => {
                          await ilanDurumGuncelle(ilan.id, "ILGILENIYOR");
                        });
                      }}
                      className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-paper hover:bg-white/8 disabled:opacity-50"
                    >
                      Takibe al
                    </button>
                  )}
                {ilan.durum !== "ELENDI" && (
                  <button
                    type="button"
                    disabled={bekliyor}
                    onClick={() => {
                      setMenuAcik(false);
                      baslat(async () => {
                        await ilanDurumGuncelle(ilan.id, "ELENDI");
                      });
                    }}
                    className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-fog hover:bg-white/8 disabled:opacity-50"
                  >
                    Geç
                  </button>
                )}
                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={() => {
                    if (!window.confirm("Bu ilanı silmek istediğine emin misin?"))
                      return;
                    setMenuAcik(false);
                    baslat(async () => {
                      await ilanSil(ilan.id);
                    });
                  }}
                  className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-ember/90 hover:bg-ember/10 disabled:opacity-50"
                >
                  Sil
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rota — tek odak */}
      <h2 className="mt-2 font-display text-[1.35rem] font-bold leading-snug tracking-tight text-paper sm:text-2xl">
        {rota}
      </h2>

      {/* Fiyat — tek satır, formülsüz */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {fiyat.ana ? (
          <p className="font-display text-xl font-bold text-amber">{fiyat.ana}</p>
        ) : fiyat.belirsiz ? (
          <p className="text-sm font-semibold text-fog">Fiyat belirsiz</p>
        ) : (
          <p className="text-sm font-semibold text-fog">Fiyat yok</p>
        )}
        {fiyat.tahmin && (
          <p className="text-sm text-fog">{fiyat.tahmin}</p>
        )}
      </div>

      {metaParcalar.length > 0 && (
        <p className="mt-1.5 text-sm text-fog">{metaParcalar.join(" · ")}</p>
      )}

      {/* Rozet — sadece önemli */}
      {(ilan.durum === "ALINDI" ||
        ilan.durum === "ILETISIME_GECILDI" ||
        ilan.durum === "ILGILENIYOR" ||
        ilan.durum === "PAZARLIKTA" ||
        ilan.donusTalebiId ||
        ilan.koridorTipi === "VARIS" ||
        ilan.aracUzunluk != null ||
        aracBelirsizMi(ilan.aracTipi, ilan.aracTipiKod)) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ilan.durum === "ALINDI" && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-paper">
              Alındı
            </span>
          )}
          {ilan.durum === "ILETISIME_GECILDI" && (
            <span className="rounded-md bg-amber/15 px-2 py-0.5 text-xs font-semibold text-amber">
              Arandı
            </span>
          )}
          {ilan.durum === "ILGILENIYOR" && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-paper">
              Takipte
            </span>
          )}
          {ilan.durum === "PAZARLIKTA" && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-paper">
              Pazarlık
            </span>
          )}
          {(ilan.donusTalebiId || ilan.koridorTipi === "VARIS") && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-paper">
              Dönüş yükü
            </span>
          )}
          {ilan.aracUzunluk != null && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-fog">
              {ilan.aracUzunluk.toLocaleString("tr-TR", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              m
            </span>
          )}
          {aracBelirsizMi(ilan.aracTipi, ilan.aracTipiKod) && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-fog">
              Araç belirsiz
            </span>
          )}
        </div>
      )}

      {/* Net — tek satır; detay gizli */}
      {karVar && ilan.kar?.net && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#f0f5f4] px-3 py-2.5">
          <span className="text-sm text-fog">Tahmini net</span>
          <span
            className={`font-display text-lg font-bold ${
              ilan.kar.netPozitif === false ? "text-ember" : "text-paper"
            }`}
          >
            {ilan.kar.net}
          </span>
        </div>
      )}

      {karVar && (
        <button
          type="button"
          onClick={() => setMaliyetAcik((v) => !v)}
          className="mt-2 text-xs font-semibold text-fog underline-offset-2 hover:text-paper hover:underline"
        >
          {maliyetAcik ? "Maliyeti gizle" : "Mesafe / yakıt göster"}
        </button>
      )}

      {maliyetAcik && ilan.kar && (
        <div className="mt-2 space-y-1 rounded-xl border border-black/8 bg-[#f0f5f4] px-3 py-2.5 text-sm text-fog">
          {ilan.kar.mesafe && <p>Mesafe: {ilan.kar.mesafe}</p>}
          {ilan.kar.yakit && <p>Yakıt: {ilan.kar.yakit}</p>}
          {ilan.kar.hgs && <p>HGS: {ilan.kar.hgs}</p>}
          {ilan.kar.tlKm && <p>₺/km: {ilan.kar.tlKm}</p>}
          {ilan.kar.uyari && (
            <p className="pt-1 text-ember">{ilan.kar.uyari}</p>
          )}
        </div>
      )}

      {/* İletişim */}
      <div className="mt-3 border-t border-black/8 pt-3">
        {ilan.firmaAdi && (
          <p className="truncate text-sm font-medium text-paper/90">
            {ilan.firmaAdi}
          </p>
        )}
        {ilan.telefon ? (
          <a
            href={`tel:${ilan.telefon}`}
            className="mt-0.5 inline-block text-base font-bold tracking-wide text-amber"
          >
            {ilan.telefon}
          </a>
        ) : (
          <p className="mt-0.5 text-sm text-fog">Telefon yok</p>
        )}
      </div>

      {ilan.donusOnerileri && ilan.donusOnerileri.length > 0 && (
        <p className="mt-2 text-xs text-fog">
          Dönüş:{" "}
          <Link
            href={`/ai/yukler?sekme=HEPSI&id=${ilan.donusOnerileri[0].id}`}
            className="font-semibold text-paper hover:underline"
          >
            {ilan.donusOnerileri[0].rota}
          </Link>
          {" · "}
          <Link
            href={`/plan?nerede=${encodeURIComponent(ilan.varisIl || ilan.nereye || "")}`}
            className="font-semibold text-amber hover:underline"
          >
            Planla
          </Link>
        </p>
      )}

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setDetayAcik((v) => !v)}
          className="text-xs font-semibold text-fog underline-offset-2 hover:text-paper hover:underline"
        >
          {detayAcik ? "Mesajı gizle" : "Ham mesaj"}
        </button>
        {detayAcik && (
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[#f0f5f4] px-3 py-2 text-sm leading-relaxed text-fog">
            {ilan.hamMetin}
          </p>
        )}
      </div>

      {/* İki net aksiyon */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {iletisimVar ? (
          <BilgiSorButonu
            ilanId={ilan.id}
            gonderenUserId={ilan.gonderenUserId}
            telefon={ilan.telefon}
          />
        ) : (
          <div className="rounded-xl border border-black/12 py-3.5 text-center text-sm text-fog">
            Yazılamaz
          </div>
        )}
        {ilan.telefon ? (
          <a
            href={`tel:${ilan.telefon}`}
            className="flex items-center justify-center rounded-xl bg-amber py-3.5 text-sm font-bold text-[#1a1208] hover:brightness-110"
          >
            Ara
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl border border-black/12 py-3.5 text-sm text-fog/50">
            Ara
          </span>
        )}
      </div>
    </article>
  );
}
