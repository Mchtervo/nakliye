"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import PushIzinButonu from "@/components/PushIzinButonu";

type Durum = "kontrol" | "eskiUygulama" | "safari" | "yeniUygulama" | "diger";

function standaloneMi(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function iosMu(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** Bu cihazın push aboneliği logo değişiminden önce mi açılmış? */
export async function simgeEskiMi(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const kayit = await navigator.serviceWorker.getRegistration("/");
    const abone = await kayit?.pushManager.getSubscription();
    if (!abone) return false;
    const r = await fetch("/api/push/ikon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: abone.endpoint }),
    });
    return ((await r.json()) as { eski?: boolean }).eski === true;
  } catch {
    return false;
  }
}

/** Ana ekran uygulamasından Safari'yi açar (iOS 17+). */
export function safariLinki(yol = "/ana-ekran"): string {
  return `x-safari-https://${window.location.host}${yol}`;
}

const adimSinif = "flex gap-3 rounded-2xl bg-[#1c1c1e] p-4";
const numara = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber text-sm font-bold text-black";

export default function AnaEkranRehber({ acikAnahtar }: { acikAnahtar: string | null }) {
  const [durum, setDurum] = useState<Durum>("kontrol");
  const [adres, setAdres] = useState("");

  useEffect(() => {
    let iptal = false;
    void (async () => {
      const ayar = (d: Durum) => !iptal && setDurum(d);
      setAdres(window.location.origin);
      if (!iosMu()) return ayar("diger");
      if (!standaloneMi()) return ayar("safari");
      ayar((await simgeEskiMi()) ? "eskiUygulama" : "yeniUygulama");
    })();
    return () => {
      iptal = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-md space-y-4 pb-24">
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <Logo boyut={88} />
        <h1 className="font-display text-2xl font-extrabold text-paper">Yeni simgeyi ana ekrana al</h1>
      </div>

      {durum === "eskiUygulama" && (
        <>
          <p className="text-center text-sm text-fog">
            Ana ekrandaki simgen eski. iPhone simgeyi kendisi değiştirmiyor; Safari&apos;den bir kere
            eklememiz gerekiyor. 1 dakika sürer.
          </p>
          <a href={safariLinki()} className="btn btn-amber w-full !py-3 text-base">
            Safari&apos;de aç
          </a>
          <p className="text-center text-xs text-fog">
            Açılmazsa Safari&apos;yi kendin aç ve şu adrese git: <span className="select-all text-paper">{adres}/ana-ekran</span>
          </p>
        </>
      )}

      {durum === "safari" && (
        <>
          <div className={adimSinif}>
            <span className={numara}>1</span>
            <p className="text-sm text-paper">
              Alttaki <b>Paylaş</b> düğmesine bas
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-1 inline h-5 w-5 align-[-4px] text-sky-400">
                <path d="M12 3v12M8 7l4-4 4 4" />
                <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
              </svg>
              . Görmüyorsan adres çubuğundaki <b>•••</b> menüsünde.
            </p>
          </div>
          <div className={adimSinif}>
            <span className={numara}>2</span>
            <p className="text-sm text-paper">
              Listeyi aşağı kaydır, <b>Ana Ekrana Ekle</b>&apos;ye bas.
            </p>
          </div>
          <div className={adimSinif}>
            <span className={numara}>3</span>
            <p className="text-sm text-paper">
              Sağ üstte <b>Ekle</b>&apos;ye bas. Yeni turuncu rota simgesi ana ekrana gelir.
            </p>
          </div>
          <div className={adimSinif}>
            <span className={numara}>4</span>
            <p className="text-sm text-paper">
              Yeni simgeyi aç, <b>bildirimleri aç</b>&apos;a bas. Sonra <b>eski kamyon simgesine</b> basılı tut →
              Uygulamayı Sil.
            </p>
          </div>
          {/* Paylaş düğmesini gösteren ok (Safari alt çubuğu ortası) */}
          <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-2 z-50 flex justify-center">
            <svg viewBox="0 0 40 56" className="ok-zipla h-14 w-10 text-amber drop-shadow-[0_2px_8px_rgba(255,149,0,0.6)]">
              <path d="M20 2v44M8 34l12 14 12-14" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </>
      )}

      {durum === "yeniUygulama" && (
        <>
          <p className="text-center text-sm text-paper">
            Harika, yeni simgeden açtın. Son iki adım:
          </p>
          <div className={adimSinif}>
            <span className={numara}>1</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm text-paper">Bu cihazda bildirimleri aç (yük ve ödeme bildirimleri için).</p>
              <PushIzinButonu acikAnahtar={acikAnahtar} />
            </div>
          </div>
          <div className={adimSinif}>
            <span className={numara}>2</span>
            <p className="text-sm text-paper">
              Ana ekrandaki <b>eski kamyon simgesine</b> basılı tut → <b>Uygulamayı Sil</b> → Ana Ekrandan Kaldır.
            </p>
          </div>
        </>
      )}

      {durum === "diger" && (
        <p className="text-center text-sm text-fog">
          Bu cihazda simge kendiliğinden güncellenir (Android en geç 1 gün içinde). Bir şey yapmana gerek yok.
        </p>
      )}
    </div>
  );
}
