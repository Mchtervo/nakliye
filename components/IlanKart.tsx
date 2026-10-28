"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ilanDurumGuncelle, ilanSil } from "@/app/ai-actions";
import BilgiSorButonu from "@/components/BilgiSorButonu";
import { aracBelirsizMi } from "@/lib/arac";
import { beklemeBuyuk } from "@/lib/ilanTazelik";
import { fiyatGorunumu, gecenSure } from "@/lib/ilanGorunum";
import { whatsappMesajUrl } from "@/lib/whatsapp";

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
  yukTipi?: string | null;
  aracTipi: string | null;
  aracTipiKod: string | null;
  aracUzunluk?: number | null;
  koridorTipi?: string | null;
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz: boolean;
  firmaAdi: string | null;
  telefon: string | null;
  /** Asistanın WhatsApp sorusu: sırada, yazıldı, cevap yok veya konuşma özeti. */
  waNot?: string | null;
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
  const [menuAcik, setMenuAcik] = useState(false);

  const fiyat = fiyatGorunumu(ilan);
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

  // Tek rozet: en önemli durum. Kalan uyarılar "Detay"da.
  const durumRozeti: { yazi: string; renk: string } | null =
    ilan.durum === "ALINDI"
      ? { yazi: "Alındı", renk: "bg-teal/15 text-teal" }
      : ilan.durum === "PAZARLIKTA"
        ? { yazi: "Pazarlık", renk: "bg-amber/15 text-amber" }
        : ilan.durum === "ILETISIME_GECILDI"
          ? { yazi: "Arandı", renk: "bg-amber/15 text-amber" }
          : ilan.durum === "ILGILENIYOR"
            ? { yazi: "Takipte", renk: "bg-white/10 text-paper" }
            : ilan.durum === "ELENDI"
              ? { yazi: "Elendi", renk: "bg-ember/15 text-ember" }
              : ilan.donusTalebiId || ilan.koridorTipi === "VARIS"
                ? { yazi: "Dönüş", renk: "bg-white/10 text-paper" }
                : null;

  const bilgiParcalar = [
    ilan.tonaj ? `${ilan.tonaj} ton` : null,
    ilan.aracTipi || null,
    ilan.aracUzunluk != null
      ? `${ilan.aracUzunluk.toLocaleString("tr-TR", {
          maximumFractionDigits: 2,
        })} m`
      : null,
    ilan.yukTipi || null,
  ].filter(Boolean) as string[];

  const uyarilar = [
    !ilan.varisIl && ilan.cikisIl ? "Varış belirtilmemiş" : null,
    ilan.koridorTipi === "CIKIS" && ilan.varisIl ? "Varış bölge dışında" : null,
    aracBelirsizMi(ilan.aracTipi, ilan.aracTipiKod) ? "Araç tipi belirsiz" : null,
    ilan.kar?.uyari || null,
  ].filter(Boolean) as string[];

  const waUrl = ilan.telefon ? whatsappMesajUrl(ilan.telefon, "") : null;
  const cikis = ilan.nereden || ilan.cikisIl || "?";
  const varis = ilan.nereye || ilan.varisIl || null;

  const menuOge =
    "block w-full px-3 py-2.5 text-left text-sm font-semibold hover:bg-white/8 disabled:opacity-50";

  return (
    <article
      id={`ilan-${ilan.id}`}
      className={`cam p-4 ${ilan.odakli ? "ring-2 ring-amber/40" : ""} ${
        ilan.vurgulu ? "ring-1 ring-teal/30" : ""
      } ${ilan.soluk || ilan.durum === "CEVAP_YOK" ? "opacity-70" : ""}`}
    >
      {/* 1. Rota + menü */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 font-display text-[1.25rem] font-bold leading-snug tracking-tight text-paper">
          {cikis}
          <span className="mx-1.5 text-fog">→</span>
          {varis ?? <span className="text-base font-semibold text-fog">varış yok</span>}
        </h2>
        <div className="relative -mr-1 -mt-1 shrink-0">
          <button
            type="button"
            aria-label="Diğer işlemler"
            aria-expanded={menuAcik}
            onClick={() => setMenuAcik((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none text-fog hover:bg-white/8 hover:text-paper"
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
              <div className="absolute right-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-white/12 bg-[#2c2c2e] py-1 shadow-xl">
                {ilan.durum !== "ALINDI" && (
                  <button type="button" disabled={bekliyor} onClick={alindiIsaretle} className={`${menuOge} text-paper`}>
                    Alındı
                  </button>
                )}
                <button type="button" disabled={bekliyor} onClick={yukeCevir} className={`${menuOge} text-paper`}>
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
                      className={`${menuOge} text-paper`}
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
                    className={`${menuOge} text-fog`}
                  >
                    Geç
                  </button>
                )}
                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={() => {
                    if (!window.confirm("Bu ilanı silmek istediğine emin misin?")) return;
                    setMenuAcik(false);
                    baslat(async () => {
                      await ilanSil(ilan.id);
                    });
                  }}
                  className={`${menuOge} text-ember/90 hover:!bg-ember/10`}
                >
                  Sil
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Zaman + tek rozet */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fog">
        <span>
          <span className="font-semibold text-paper/80">{bekleme}</span> · {gecenSure(tazeTarih)}
        </span>
        {durumRozeti && (
          <span className={`rounded-md px-1.5 py-0.5 font-semibold ${durumRozeti.renk}`}>
            {durumRozeti.yazi}
          </span>
        )}
      </div>

      {/* 3. Yük bilgisi — tek satır */}
      {bilgiParcalar.length > 0 && (
        <p className="mt-2 truncate text-sm text-paper/85">{bilgiParcalar.join(" · ")}</p>
      )}

      {/* 4. Fiyat solda, tahmini net sağda */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {fiyat.ana ? (
            <p className="font-display text-xl font-bold leading-none text-amber">
              {fiyat.ana}
              {fiyat.tahmin && (
                <span className="ml-2 text-sm font-semibold text-fog">{fiyat.tahmin}</span>
              )}
            </p>
          ) : (
            <p className="text-sm font-semibold text-fog">
              {fiyat.belirsiz ? "Fiyat belirsiz" : "Fiyat yazmıyor"}
            </p>
          )}
        </div>
        {karVar && ilan.kar?.net && ilan.kar.net !== "fiyat okunamadı" && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-fog">Net</p>
            <p
              className={`font-display text-base font-bold leading-tight ${
                ilan.kar.netPozitif === false ? "text-ember" : "text-teal"
              }`}
            >
              {ilan.kar.net}
            </p>
          </div>
        )}
      </div>

      {ilan.waNot && (
        <p className="mt-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-paper/80">
          {ilan.waNot}
        </p>
      )}

      {/* 5. Aksiyonlar: WhatsApp · Ara · Sor */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl bg-amber py-3 text-sm font-bold text-[#1a1208] hover:brightness-110"
          >
            WhatsApp
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl border border-white/12 py-3 text-sm text-fog/50">
            WhatsApp
          </span>
        )}
        {ilan.telefon ? (
          <a
            href={`tel:${ilan.telefon}`}
            className="flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] py-3 text-sm font-bold text-paper hover:bg-white/[0.12]"
          >
            Ara
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl border border-white/12 py-3 text-sm text-fog/50">
            Ara
          </span>
        )}
        {iletisimVar ? (
          <BilgiSorButonu
            ilanId={ilan.id}
            gonderenUserId={ilan.gonderenUserId}
            telefon={ilan.telefon}
          />
        ) : (
          <span className="flex items-center justify-center rounded-xl border border-white/12 py-3 text-sm text-fog/50">
            Sor
          </span>
        )}
      </div>

      {/* 6. Alt satır: firma/numara + detay */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-fog">
        <span className="min-w-0 truncate">
          {[ilan.firmaAdi, ilan.telefon].filter(Boolean).join(" · ") || "İletişim yok"}
        </span>
        <button
          type="button"
          onClick={() => setDetayAcik((v) => !v)}
          className="shrink-0 font-semibold text-fog underline-offset-2 hover:text-paper hover:underline"
        >
          {detayAcik ? "Kapat" : `Detay${uyarilar.length ? ` (${uyarilar.length})` : ""}`}
        </button>
      </div>

      {detayAcik && (
        <div className="mt-2 space-y-2 rounded-xl bg-white/[0.05] p-3 text-sm text-fog">
          {uyarilar.length > 0 && (
            <ul className="space-y-0.5 text-amber">
              {uyarilar.map((u) => (
                <li key={u}>• {u}</li>
              ))}
            </ul>
          )}
          {ilan.kar && (ilan.kar.mesafe || ilan.kar.yakit || ilan.kar.hgs || ilan.kar.tlKm) && (
            <p>
              {[
                ilan.kar.mesafe && `Mesafe ${ilan.kar.mesafe}`,
                ilan.kar.yakit && `Yakıt ${ilan.kar.yakit}`,
                ilan.kar.hgs && `HGS ${ilan.kar.hgs}`,
                ilan.kar.tlKm && `${ilan.kar.tlKm}/km`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {ilan.kaynakAd && <p>Kaynak: {ilan.kaynakAd}</p>}
          {ilan.donusOnerileri && ilan.donusOnerileri.length > 0 && (
            <p>
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
          <p className="whitespace-pre-wrap border-t border-white/8 pt-2 leading-relaxed text-paper/75">
            {ilan.hamMetin}
          </p>
        </div>
      )}
    </article>
  );
}
