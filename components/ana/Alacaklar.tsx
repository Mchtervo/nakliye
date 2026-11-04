import Link from "next/link";
import { tlYazKisa } from "@/lib/para";
import { telefonGoster, telefonTelHref } from "@/lib/telefon";
import { whatsappMesajUrl } from "@/lib/whatsapp";

export type Alacak = { id: number; ad: string; kalan: number; telefon: string | null };

const RENKLER = ["#4f6bff", "#8b5cf6", "#f97316", "#0ea5e9", "#10b981", "#ec4899"];

function basHarfler(ad: string): string {
  const k = ad.trim().split(/\s+/).filter(Boolean);
  return ((k[0]?.[0] ?? "") + (k[1]?.[0] ?? "")).toLocaleUpperCase("tr-TR") || "?";
}

/** "Kimde para kaldı?": açık alacağı olan firmalar, ara / WhatsApp. */
export default function Alacaklar({ firmalar }: { firmalar: Alacak[] }) {
  if (firmalar.length === 0) return null;
  return (
    <section className="ana-alacak ana-gir" style={{ animationDelay: "380ms" }} aria-labelledby="alacaklar">
      <div className="flex items-center justify-between">
        <h2 id="alacaklar" className="ana-baslik">Kimde para kaldı?</h2>
        <Link href="/para?sekme=cari" className="ana-link">
          Tümü →
        </Link>
      </div>
      <ul className="mt-2">
        {firmalar.map((f, i) => {
          const tel = f.telefon ? telefonTelHref(f.telefon) : null;
          const wa = f.telefon ? whatsappMesajUrl(f.telefon, "") : null;
          const renk = RENKLER[i % RENKLER.length];
          return (
            <li key={f.id} className="flex items-center gap-2 border-b border-[#e3e7f6] py-2 last:border-0">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white shadow-[0_6px_14px_-6px_currentColor]"
                style={{ background: `linear-gradient(145deg, ${renk}, ${renk}cc)`, color: renk }}
                aria-hidden
              >
                <span className="text-white">{basHarfler(f.ad)}</span>
              </span>
              <Link href={`/firmalar/${f.id}`} className="-my-2.5 min-w-0 flex-1 truncate py-2.5 text-[14px] font-semibold">
                {f.ad}
              </Link>
              <span className="mr-1 shrink-0 text-[14px] font-bold tabular-nums">{tlYazKisa(f.kalan)}</span>
              {tel && (
                <a href={tel} className="ana-yuvarlak text-[#4f46e5]" aria-label={`${f.ad}: ${telefonGoster(f.telefon!)} ara`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
                    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
                  </svg>
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="ana-yuvarlak text-[#16a34a]" aria-label={`${f.ad}: WhatsApp`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[19px] w-[19px]">
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.24.68-1.42 1.3-1.96 1.35-.5.05-1.13.07-1.82-.11a16.6 16.6 0 0 1-1.65-.61 12.9 12.9 0 0 1-4.94-4.37c-.37-.5-.94-1.33-.94-2.54s.63-1.8.86-2.05a.9.9 0 0 1 .65-.3h.47c.15 0 .35-.06.55.42.2.5.69 1.7.75 1.83.06.12.1.27.02.43-.08.17-.12.27-.25.41l-.37.43c-.12.12-.25.26-.11.5.15.25.65 1.07 1.4 1.73.96.85 1.77 1.12 2.02 1.24.25.13.4.1.54-.06.15-.17.62-.72.78-.97.17-.25.33-.2.56-.12.23.08 1.45.68 1.7.81.25.12.41.18.47.29.06.1.06.6-.17 1.27z" />
                  </svg>
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
