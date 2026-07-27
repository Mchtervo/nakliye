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
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz: boolean;
  firmaAdi: string | null;
  telefon: string | null;
  gonderenUserId: string | null;
  guvenSkoru: number;
  hamMetin: string;
  createdAt: Date | string;
  donusTalebiId: number | null;
  kaynakAd: string | null;
  ucretYazi: string | null;
  odakli?: boolean;
  soluk?: boolean;
  vurgulu?: boolean;
  kar?: IlanKartKar | null;
  /** Bu yükü alırsan dönüşte… */
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
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  const createdAt =
    typeof ilan.createdAt === "string"
      ? new Date(ilan.createdAt)
      : ilan.createdAt;
  const iletisimVar = Boolean(ilan.gonderenUserId || ilan.telefon);
  const bekleme = beklemeBuyuk(createdAt);

  const metaSatir = [
    ilan.tonaj ? `${ilan.tonaj} ton` : null,
    ilan.aracTipi || null,
    fiyat.ana,
    fiyat.belirsiz ? "fiyat belirsiz" : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
      className={`rounded-2xl border p-4 sm:p-5 ${
        ilan.vurgulu
          ? "border-teal/35 bg-teal/8"
          : "border-white/10 bg-white/[0.04]"
      } ${ilan.odakli ? "ring-2 ring-teal/45" : ""} ${
        ilan.soluk || ilan.durum === "CEVAP_YOK" ? "opacity-45" : ""
      }`}
    >
      {/* Bekleme + rota */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`font-display text-2xl font-extrabold leading-none tracking-tight sm:text-3xl ${
              ilan.soluk ? "text-fog" : "text-amber"
            }`}
          >
            {bekleme}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-fog">
            bekliyor
          </p>
          <h2 className="font-display mt-2 text-xl font-extrabold leading-tight text-paper sm:text-2xl">
            {rota}
          </h2>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Diğer işlemler"
            aria-expanded={menuAcik}
            onClick={() => setMenuAcik((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-lg text-fog hover:bg-white/8 hover:text-paper"
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
              <div className="absolute right-0 z-20 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-white/15 bg-asphalt-2 py-1 shadow-xl">
                {ilan.durum !== "ALINDI" && (
                  <button
                    type="button"
                    disabled={bekliyor}
                    onClick={alindiIsaretle}
                    className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-teal hover:bg-white/8 disabled:opacity-50"
                  >
                    Alındı (dönüş ara)
                  </button>
                )}
                <button
                  type="button"
                  disabled={bekliyor}
                  onClick={yukeCevir}
                  className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-paper hover:bg-white/8 disabled:opacity-50"
                >
                  Yüke çevir
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
                    İlgilenmiyorum
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

      {/* Rozetler */}
      {(ilan.donusTalebiId ||
        ilan.durum === "PAZARLIKTA" ||
        ilan.durum === "ALINDI" ||
        aracBelirsizMi(ilan.aracTipi, ilan.aracTipiKod)) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ilan.durum === "ALINDI" ? (
            <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ok">
              Alındı
            </span>
          ) : null}
          {ilan.donusTalebiId ? (
            <span className="rounded-md bg-teal/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal">
              Dönüş
            </span>
          ) : null}
          {ilan.durum === "PAZARLIKTA" ? (
            <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-200">
              Pazarlıkta
            </span>
          ) : null}
          {aracBelirsizMi(ilan.aracTipi, ilan.aracTipiKod) ? (
            <span className="rounded-md bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
              Araç belirsiz
            </span>
          ) : null}
        </div>
      )}

      {metaSatir && (
        <p className="mt-2 text-sm font-semibold text-fog sm:text-base">
          {metaSatir}
          {fiyat.tahmin ? (
            <span className="ml-1 font-normal text-fog/80">({fiyat.tahmin})</span>
          ) : null}
        </p>
      )}

      {/* Kâr paneli */}
      {ilan.kar && (ilan.kar.mesafe || ilan.kar.net) && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
            {ilan.kar.mesafe && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                  Mesafe
                </div>
                <div className="font-semibold text-paper">{ilan.kar.mesafe}</div>
              </div>
            )}
            {ilan.kar.yakit && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                  Yakıt
                </div>
                <div className="font-semibold text-paper">{ilan.kar.yakit}</div>
              </div>
            )}
            {ilan.kar.hgs && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                  HGS
                </div>
                <div className="font-semibold text-paper">{ilan.kar.hgs}</div>
              </div>
            )}
            {ilan.kar.tlKm && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
                  ₺/km
                </div>
                <div className="font-semibold text-paper">{ilan.kar.tlKm}</div>
              </div>
            )}
          </div>
          {ilan.kar.net && (
            <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-white/8 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fog">
                Net kazanç
              </span>
              <span
                className={`font-display text-xl font-extrabold ${
                  ilan.kar.netPozitif === false ? "text-ember" : "text-teal"
                }`}
              >
                {ilan.kar.net}
              </span>
            </div>
          )}
          {ilan.kar.uyari && (
            <p className="mt-2 rounded-lg border border-ember/30 bg-ember/10 px-2 py-1.5 text-[11px] font-semibold text-ember">
              {ilan.kar.uyari}
            </p>
          )}
        </div>
      )}

      <div className="mt-2 space-y-0.5 text-sm text-paper/90">
        {ilan.firmaAdi && (
          <div className="truncate font-medium">{ilan.firmaAdi}</div>
        )}
        {ilan.telefon && (
          <a
            href={`tel:${ilan.telefon}`}
            className="inline-block font-semibold text-teal hover:underline"
          >
            {ilan.telefon}
          </a>
        )}
      </div>

      <p className="mt-2 text-xs text-fog">
        {gecenSure(createdAt)}
        {ilan.kaynakAd ? ` · ${ilan.kaynakAd}` : ""}
        {` · %${ilan.guvenSkoru}`}
      </p>

      {ilan.donusOnerileri && ilan.donusOnerileri.length > 0 && (
        <div className="mt-3 rounded-xl border border-teal/25 bg-teal/8 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal">
            Bu yükü alırsan dönüşte
          </p>
          <ul className="mt-1 space-y-1">
            {ilan.donusOnerileri.map((d) => (
              <li key={d.id} className="text-xs text-paper/90">
                <Link
                  href={`/ai/yukler?sekme=HEPSI&id=${d.id}`}
                  className="font-semibold text-teal hover:underline"
                >
                  {d.rota}
                </Link>
                {d.fiyat ? ` · ${d.fiyat}` : ""}
              </li>
            ))}
          </ul>
          <Link
            href={`/plan?nerede=${encodeURIComponent(ilan.varisIl || ilan.nereye || "")}`}
            className="mt-1.5 inline-block text-[11px] font-semibold text-amber hover:underline"
          >
            Tur planla →
          </Link>
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setDetayAcik((v) => !v)}
          className="text-xs font-semibold text-amber hover:underline"
        >
          {detayAcik ? "Detayı gizle" : "Detay"}
        </button>
        {detayAcik && (
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm leading-relaxed text-fog">
            {ilan.hamMetin}
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {iletisimVar ? (
          <div className="min-w-0 flex-1 [&_button]:w-full [&_button]:!px-3 [&_button]:!py-3 [&_button]:text-sm">
            <BilgiSorButonu
              ilanId={ilan.id}
              gonderenUserId={ilan.gonderenUserId}
              telefon={ilan.telefon}
            />
          </div>
        ) : (
          <div className="flex-1 rounded-xl border border-white/10 px-3 py-3 text-center text-sm text-fog">
            İletişim yok
          </div>
        )}
        {ilan.telefon ? (
          <a
            href={`tel:${ilan.telefon}`}
            className="flex flex-1 items-center justify-center rounded-xl border border-teal/40 bg-teal/15 px-3 py-3 text-sm font-bold text-teal hover:bg-teal/25"
          >
            Ara
          </a>
        ) : (
          <span className="flex flex-1 items-center justify-center rounded-xl border border-white/10 px-3 py-3 text-sm text-fog/50">
            Ara
          </span>
        )}
      </div>
    </article>
  );
}
