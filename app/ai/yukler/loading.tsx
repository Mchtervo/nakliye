import { anaYazi } from "@/components/ana/yazi";

/** Yük bul açılırken: açık zeminli iskelet (sayfa açık temalı; koyu iskelet ekranı karartıyordu). */
export default function YuklerYukleniyor() {
  return (
    <div className={`ana ${anaYazi.variable}`} role="status" aria-label="Yük aranıyor">
      <div className="ana-ic space-y-4 py-5">
        <div className="ana-iskelet h-3 w-20" />
        <div className="ana-iskelet h-9 w-40" />
        <div className="ana-iskelet h-28" />
        <div className="ana-iskelet h-36" />
        <div className="ana-iskelet h-36" />
        <p className="pt-2 text-center text-[15px] text-[var(--a-ikincil)]">Yük aranıyor…</p>
      </div>
    </div>
  );
}
