import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import BildirimZili from "@/components/BildirimZili";

export type Donem = { etiket: string; oncekiHref: string; sonrakiHref: string };

/** Ay seçici: önceki / sonraki ay bağlantıları (sayfa ?ay= ile yeniden hesaplanır). */
export function DonemSecici({ d }: { d: Donem }) {
  return (
    <div className="rp-donem" role="group" aria-label="Dönem seç">
      <Link href={d.oncekiHref} scroll={false} aria-label="Önceki ay" className="rp-donem-ok">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <span className="flex min-w-0 items-center gap-1.5 px-1 capitalize">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 opacity-80" aria-hidden>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </svg>
        <span className="truncate">{d.etiket}</span>
      </span>
      <Link href={d.sonrakiHref} scroll={false} aria-label="Sonraki ay" className="rp-donem-ok">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

/**
 * Finans sayfalarının lacivert başlığı: marka, geri / zil, isteğe bağlı dönem
 * seçici ve sağda süs görseli. Altına beyaz yüzey biner (.rp-yuzey).
 */
export default function RaporUst({
  geriHref,
  donem,
  gorsel,
  children,
  sinif = "",
}: {
  geriHref?: string;
  donem?: Donem;
  gorsel?: { src: string; genislik: number };
  children: ReactNode;
  sinif?: string;
}) {
  return (
    <header className={`ana-ust rp-ust ${sinif}`}>
      <div className="ana-ust-zemin" aria-hidden />
      <div className="ana-ic relative">
        <div className="ana-gir flex items-center justify-between gap-3 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            {geriHref && (
              <Link href={geriHref} aria-label="Geri" className="ana-zil -ml-1 mr-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </Link>
            )}
            <Image src="/ana/logo-2.png" alt="" width={40} height={36} className="h-9 w-10 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-white">Nakliye Defteri</p>
              <p className="text-[12px] font-semibold text-[#9fb0ff]">Yük Avcısı</p>
            </div>
          </div>
          {!geriHref && <BildirimZili tema="cam" />}
        </div>

        {donem && (
          <div className="ana-gir mt-3 flex justify-end" style={{ animationDelay: "30ms" }}>
            <DonemSecici d={donem} />
          </div>
        )}

        <div className="relative mt-2">
          <div className="ana-gir relative z-10" style={{ animationDelay: "50ms" }}>
            {children}
          </div>
          {gorsel && <Image src={gorsel.src} alt="" width={gorsel.genislik} height={gorsel.genislik} className="rp-ust-gorsel" style={{ width: `${gorsel.genislik / 16}rem` }} priority />}
        </div>
      </div>
    </header>
  );
}
