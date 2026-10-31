import { BelgeEkle, BelgeSatirIslem } from "@/components/BelgeFormu";
import { belgeAdi, kalanGun } from "@/lib/belge";
import { prisma } from "@/lib/prisma";

function tarihInput(d: Date): string {
  const y = d.getFullYear();
  const a = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${a}-${g}`;
}

/** Ana sayfa: belgeler bitişe göre; ≤30 gün turuncu, ≤7 gün ve geçen kırmızı. */
export default async function BelgeKarti() {
  const belgeler = await prisma.belge.findMany({ orderBy: { bitis: "asc" } }).catch(() => []);
  const simdi = new Date();
  const acil = belgeler.filter((b) => kalanGun(b.bitis, simdi) <= 30).length;

  return (
    <section id="belgeler" className="kart space-y-3 p-4 sm:p-5 reveal">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber">Belgeler</p>
        <h2 className="font-display text-xl font-bold">
          {belgeler.length === 0
            ? "Muayene, sigorta, kasko…"
            : acil > 0
              ? `${acil} belgenin süresi yaklaşıyor`
              : "Belgeler güncel"}
        </h2>
        {belgeler.length === 0 && (
          <p className="mt-1 text-sm text-fog">
            Bitiş tarihlerini bir kez gir; 30, 7 ve 1 gün kala telefona bildirim gelsin.
          </p>
        )}
      </div>

      {belgeler.length > 0 && (
        <ul className="space-y-1.5">
          {belgeler.map((b) => {
            const kalan = kalanGun(b.bitis, simdi);
            const renk = kalan < 0 || kalan <= 7 ? "text-ember" : kalan <= 30 ? "text-amber" : "text-teal";
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white/[0.04] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-paper">{belgeAdi(b.tur, b.ad)}</p>
                  <p className="text-xs text-fog">{b.bitis.toLocaleDateString("tr-TR")}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold tabular-nums ${renk}`}>
                  {kalan < 0 ? `${-kalan} gün geçti` : kalan === 0 ? "Bugün bitiyor" : `${kalan} gün`}
                </p>
                <BelgeSatirIslem id={b.id} bitis={tarihInput(b.bitis)} />
              </li>
            );
          })}
        </ul>
      )}

      <BelgeEkle ilkAcik={belgeler.length === 0} />
    </section>
  );
}
