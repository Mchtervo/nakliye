import Link from "next/link";
import BilgiSorButonu from "@/components/BilgiSorButonu";
import { tlYazKisa } from "@/lib/para";
import type { SeferPlani } from "@/lib/seferPlan";

function gunYazi(n: number): string {
  return n <= 1 ? "Bugün" : `${n}. gün`;
}

/**
 * Bir tur planı: numaralı adımlar + tahmini sonuçlar. Mesafe ve net
 * tahminidir (il merkezleri ve ayarlardaki maliyet); kesin değildir.
 */
export default function PlanKart({ plan, ozet = true }: { plan: SeferPlani; ozet?: boolean }) {
  return (
    <div>
      <ol className="sf-plan-adimlar">
        {plan.ayaklar.map((a, i) => {
          const rota = `${a.ilan.nereden || a.ilan.cikisIl} → ${a.ilan.nereye || a.ilan.varisIl}`;
          const gelir =
            a.ilan.ucret && a.ilan.ucret > 0
              ? tlYazKisa(a.ilan.ucret)
              : a.ilan.fiyatTon && a.ilan.tonaj
                ? `~${tlYazKisa(a.ilan.fiyatTon * a.ilan.tonaj)}`
                : null;
          return (
            <li key={`${a.ilan.id}-${i}`} className="sf-plan-adim ana-gir" style={{ animationDelay: `${80 + i * 70}ms` }}>
              <span className="sf-plan-no" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[var(--a-indigo)]">
                      {gunYazi(a.gun)}
                      {a.bosKm > 0 ? <span className="text-[var(--a-ikincil)]"> · önce boş ≈{a.bosKm} km</span> : null}
                    </p>
                    <p className="truncate text-[15.5px] font-extrabold tracking-[-0.01em]">{rota}</p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[#3b4262]">≈{a.yukluKm} km</p>
                </div>
                <div className="sf-plan-ilan">
                  <span className="min-w-0 truncate">
                    {[gelir, a.ilan.firmaAdi].filter(Boolean).join(" · ") || "Fiyat yazmıyor"}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <BilgiSorButonu
                      ilanId={a.ilan.id}
                      telefon={a.ilan.telefon}
                      gonderenUserId={a.ilan.gonderenUserId}
                      etiket="Sor"
                      sinif="ana-hap !min-h-8 !px-3 !text-[12px] disabled:opacity-50"
                    />
                    <Link href={`/ai/yukler?sekme=HEPSI&id=${a.ilan.id}`} className="ana-hap !min-h-8 !px-3 !text-[12px]">
                      İlanı aç ›
                    </Link>
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {ozet && (
        <div className="sf-plan-ozet ana-gir" style={{ animationDelay: `${120 + plan.ayaklar.length * 70}ms` }}>
          <p className="text-[14px] font-extrabold">Tahmini sonuçlar</p>
          <dl className="mt-2 space-y-1.5 text-[13.5px]">
            <div className="flex justify-between">
              <dt className="text-[#3b4262]">Tahmini toplam yol</dt>
              <dd className="font-bold tabular-nums">≈{plan.toplamKm.toLocaleString("tr-TR")} km</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#3b4262]">Boş gidilen</dt>
              <dd className="font-bold tabular-nums">≈{plan.bosKm.toLocaleString("tr-TR")} km</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#3b4262]">İlanlardaki navlun</dt>
              <dd className="font-bold tabular-nums">{tlYazKisa(plan.toplamUcret)}</dd>
            </div>
            <div className="flex justify-between border-t border-[var(--a-cizgi)] pt-1.5">
              <dt className="font-bold">Tahmini net</dt>
              {/* Eski ekranla aynı kural: eksi net 0 gösterilir */}
              <dd className="font-extrabold tabular-nums text-[#16a34a]">{tlYazKisa(Math.max(0, plan.netTahmini))}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11.5px] text-[var(--a-ikincil)]">
            Tahmini plan • Mesafe il merkezlerinden, net ayarlardaki maliyetten hesaplanır. Uygunluk ve ücret yük sahibiyle teyit edilmeli.
          </p>
        </div>
      )}
    </div>
  );
}
