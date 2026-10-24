import { whatsappMesajUrl } from "@/lib/whatsapp";
import { telefonGoster } from "@/lib/telefon";

export default function WhatsAppButonu({
  telefon,
  etiket = "WhatsApp",
  className = "",
}: {
  telefon: string;
  etiket?: string;
  className?: string;
}) {
  const href = whatsappMesajUrl(telefon, "");
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-lg border border-amber/40 bg-amber/10 px-2.5 py-1.5 text-sm font-semibold text-amber transition-colors hover:bg-amber/20"
      }
      aria-label={`${telefonGoster(telefon)} WhatsApp`}
    >
      WhatsApp
      {etiket !== "WhatsApp" ? ` · ${etiket}` : ""}
    </a>
  );
}
