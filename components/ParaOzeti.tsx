import { tlYaz } from "@/lib/para";

/** Anlaşılan / Ödenen / Kalan üçlü özet */
export default function ParaOzeti({
  anlasilan,
  odenen,
}: {
  anlasilan: number;
  odenen: number;
}) {
  const kalan = Math.max(0, anlasilan - odenen);
  const kapandi = kalan === 0;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/8 bg-white/4 p-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
          Anlaşılan
        </div>
        <div className="mt-0.5 font-display text-base font-bold text-paper sm:text-lg">
          {tlYaz(anlasilan)}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
          Ödenen
        </div>
        <div className="mt-0.5 font-display text-base font-bold text-ok sm:text-lg">
          {tlYaz(odenen)}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-fog">
          Kalan
        </div>
        <div
          className={`mt-0.5 font-display text-base font-extrabold sm:text-lg ${
            kapandi ? "text-ok" : "text-amber"
          }`}
        >
          {kapandi ? "Yok" : tlYaz(kalan)}
        </div>
      </div>
    </div>
  );
}
