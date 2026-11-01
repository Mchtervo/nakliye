import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import YonetimSekmeler from "@/components/yonetim/YonetimSekmeler";

/** Mobil yönetim ekranlarının ortak kabuğu: lacivert başlık, "Yalnız yönetici", sekmeler. */
export default function YonetimKabuk({
  sekme,
  baslik,
  alt,
  geriHref,
  gorsel = "/ana/sunucu.webp",
  rozet,
  children,
}: {
  sekme: string;
  baslik: string;
  alt?: string;
  geriHref?: string;
  gorsel?: string | null;
  rozet?: Partial<Record<string, number>>;
  children: ReactNode;
}) {
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <header className="ana-ust yn-ust">
          <div className="ana-ust-zemin" aria-hidden />
          <div className="ana-ic relative">
            <div className="ana-gir flex items-center justify-between gap-2 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                {geriHref && (
                  <Link href={geriHref} aria-label="Geri" className="ana-zil -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M19 12H5M11 6l-6 6 6 6" />
                    </svg>
                  </Link>
                )}
                <Image src="/ana/logo-2.png" alt="" width={40} height={36} className="h-9 w-10 shrink-0" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-white">Nakliye Defteri</p>
                  <p className="text-[12px] font-semibold text-[#9fb0ff]">Yönetim</p>
                </div>
              </div>
              <span className="yn-yonetici-rozet">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5z" />
                </svg>
                Yalnız yönetici
              </span>
            </div>
            <div className="relative mt-4">
              <div className={`ana-gir relative z-10 ${gorsel ? "max-w-[62%]" : ""}`} style={{ animationDelay: "40ms" }}>
                <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-white">{baslik}</h1>
                {alt && <p className="mt-0.5 text-[13.5px] text-[#c7cffd]">{alt}</p>}
              </div>
              {gorsel && <Image src={gorsel} alt="" width={300} height={240} className="yn-ust-gorsel" priority />}
            </div>
          </div>
        </header>
        <div className="ana-ic relative z-10 -mt-10 pb-8">
          <div className="ana-gir" style={{ animationDelay: "70ms" }}>
            <YonetimSekmeler aktif={sekme} rozet={rozet} />
          </div>
          <div className="mt-5 space-y-6">{children}</div>
        </div>
      </HareketKok>
    </div>
  );
}
