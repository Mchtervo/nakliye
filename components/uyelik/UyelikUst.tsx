import Image from "next/image";
import Link from "next/link";

/** Üyelik sayfası başlığı: geri, ortada marka, isteğe bağlı adım çubuğu. */
export default function UyelikUst({ geriHref, adim, koyu = false }: { geriHref?: string; adim?: { no: number; toplam: number }; koyu?: boolean }) {
  return (
    <div className="relative flex items-center justify-center pt-[calc(env(safe-area-inset-top)+0.9rem)]">
      {geriHref && (
        <Link href={geriHref} aria-label="Geri" className={`uy-geri ${koyu ? "uy-geri-koyu" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
      )}
      <div className="flex flex-col items-center">
        <span className="flex items-center gap-1.5">
          <Image src="/ana/logo-2.png" alt="" width={32} height={29} className="h-7 w-8" />
          <span className={`text-[16px] font-extrabold tracking-[-0.02em] ${koyu ? "text-white" : "text-[#1e1b6b]"}`}>Yük Avcısı</span>
        </span>
        {adim && (
          <span className="mt-1.5 flex flex-col items-center gap-1.5" aria-label={`Adım ${adim.no} / ${adim.toplam}`}>
            <span className={`text-[12.5px] font-bold ${koyu ? "text-[#c7cffd]" : "text-[var(--a-ikincil)]"}`}>
              {adim.no} / {adim.toplam}
            </span>
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: adim.toplam }, (_, i) => (
                <span key={i} className={`h-[5px] w-7 rounded-full ${i < adim.no ? "bg-[#6d74ff]" : koyu ? "bg-white/20" : "bg-[#dfe2f5]"}`} />
              ))}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
