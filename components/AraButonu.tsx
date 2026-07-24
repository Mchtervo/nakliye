import { telefonTelHref, telefonGoster } from "@/lib/telefon";

/** Tek tıkla telefon araması (mobil + masaüstü tel: linki). */
export default function AraButonu({
  telefon,
  etiket = "Ara",
  buyuk = false,
  className = "",
}: {
  telefon: string;
  etiket?: string;
  buyuk?: boolean;
  className?: string;
}) {
  const href = telefonTelHref(telefon);
  if (!href) return null;

  return (
    <a
      href={href}
      className={
        className ||
        (buyuk
          ? "btn btn-teal inline-flex items-center justify-center gap-2 !px-5 !py-3"
          : "inline-flex items-center gap-1.5 rounded-lg border border-teal/40 bg-teal/10 px-2.5 py-1.5 text-sm font-semibold text-teal transition-colors hover:bg-teal/20")
      }
      aria-label={`${telefonGoster(telefon)} numarasını ara`}
    >
      <span aria-hidden>☎</span>
      {etiket}
    </a>
  );
}
