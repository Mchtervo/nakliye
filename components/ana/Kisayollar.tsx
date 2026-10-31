"use client";

import Image from "next/image";
import Link from "next/link";

type Kisayol = { href: string; ad: string; alt?: string; ikon: string; nokta?: boolean };

/** Başlığın üstüne binen beyaz kısayol kartı: Yük bul, Sefer yaz, Fiş çek, Kasa. */
export default function Kisayollar({ ogeler }: { ogeler: Kisayol[] }) {
  return (
    <nav aria-label="Kısayollar" className="ana-kisayol ana-gir" style={{ animationDelay: "120ms" }}>
      {ogeler.map((k) => (
        <div key={k.href} className="min-w-0 flex-1">
          <Link href={k.href} className="ana-kisayol-oge">
            <span className="relative">
              <Image src={k.ikon} alt="" width={64} height={58} className="ana-kisayol-ikon" />
              {k.nokta && <span className="absolute right-1.5 top-1 h-2.5 w-2.5 rounded-full bg-[#ff4d6d] ring-2 ring-white" aria-hidden />}
            </span>
            <span className="mt-1 whitespace-nowrap text-[13px] font-bold leading-tight min-[360px]:text-[14.5px]">{k.ad}</span>
            {k.alt && <span className="truncate text-[12px] font-medium text-[var(--a-ikincil)]">{k.alt}</span>}
          </Link>
        </div>
      ))}
    </nav>
  );
}
