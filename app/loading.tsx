import { anaYazi } from "@/components/ana/yazi";

/**
 * Açık zeminli iskelet. Sayfaların hepsi açık temalı (`.ana`); eski koyu iskelet
 * `.ana` içermediği için her sayfa geçişinde gövde siyaha dönüyordu ("ekran kararıyor").
 */
export default function Yukleniyor() {
  return (
    <div className={`ana ${anaYazi.variable}`} role="status" aria-label="Açılıyor">
      <div className="ana-ic space-y-4 py-5">
        <div className="ana-iskelet h-3 w-24" />
        <div className="ana-iskelet h-9 w-48" />
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="ana-iskelet h-24" />
          <div className="ana-iskelet h-24" />
        </div>
        <div className="ana-iskelet h-28" />
        <div className="ana-iskelet h-28" />
      </div>
    </div>
  );
}
