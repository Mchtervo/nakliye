import { anaYazi } from "@/components/ana/yazi";

/**
 * Açık zeminli iskelet: seferler/giderler açık temalı. Eski koyu iskelet
 * (`app/loading.tsx`) `.ana` olmadığı için sayfayı her geçişte siyaha boyuyordu.
 */
export default function AcikYukleniyor() {
  return (
    <div className={`ana ${anaYazi.variable}`} role="status" aria-label="Açılıyor">
      <div className="ana-ic space-y-4 py-5">
        <div className="ana-iskelet h-3 w-24" />
        <div className="ana-iskelet h-9 w-48" />
        <div className="ana-iskelet h-28" />
        <div className="ana-iskelet h-28" />
        <div className="ana-iskelet h-28" />
      </div>
    </div>
  );
}
