import Link from "next/link";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { ilBul } from "@/lib/iller";
import { tlYaz } from "@/lib/para";
import {
  planAdaylariniGetir,
  seferPlanlariUret,
  type SeferPlani,
} from "@/lib/seferPlan";
import BilgiSorButonu from "@/components/BilgiSorButonu";
import PlanForm from "@/components/PlanForm";

export const dynamic = "force-dynamic";

function gunYazi(n: number): string {
  if (n <= 1) return "Bugün";
  return `${n}. gün`;
}

function PlanKarti({ plan, sira }: { plan: SeferPlani; sira: number }) {
  return (
    <article className="cam p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-paper">
          Alternatif {sira}
        </h2>
        <p className="shrink-0 text-base font-bold text-paper">
          Net {tlYaz(Math.max(0, plan.netTahmini))}
        </p>
      </div>
      <p className="mt-1 text-sm text-fog">
        {plan.ayaklar.length} ayak · {plan.toplamKm} km
        {plan.bosKm > 0 ? ` · boş ${plan.bosKm} km` : ""}
      </p>

      <ol className="mt-4 space-y-3">
        {plan.ayaklar.map((a, i) => {
          const rota = `${a.ilan.nereden || a.ilan.cikisIl} → ${a.ilan.nereye || a.ilan.varisIl}`;
          const gelir =
            a.ilan.ucret && a.ilan.ucret > 0
              ? tlYaz(a.ilan.ucret)
              : a.ilan.fiyatTon && a.ilan.tonaj
                ? `~${tlYaz(a.ilan.fiyatTon * a.ilan.tonaj)}`
                : null;
          return (
            <li
              key={`${a.ilan.id}-${i}`}
              className="rounded-xl border border-black/8 bg-[#f0f5f4] p-3"
            >
              <p className="text-xs font-semibold text-fog">
                {gunYazi(a.gun)}
                {a.bosKm > 0 ? ` · boş ${a.bosKm} km` : ""}
              </p>
              <p className="mt-1 text-base font-bold leading-snug text-paper">
                {rota}
              </p>
              <p className="mt-1 text-sm text-fog">
                {[gelir, a.ilan.firmaAdi].filter(Boolean).join(" · ") ||
                  "Fiyat yok"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <BilgiSorButonu
                  ilanId={a.ilan.id}
                  telefon={a.ilan.telefon}
                  gonderenUserId={a.ilan.gonderenUserId}
                />
                <Link
                  href={`/ai/yukler?sekme=HEPSI&id=${a.ilan.id}`}
                  className="flex items-center justify-center rounded-xl border border-black/12 bg-white py-3.5 text-sm font-bold text-paper hover:bg-[#f0f5f4]"
                >
                  Aç
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

export default async function PlanSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ nerede?: string; gun?: string }>;
}) {
  const sp = await searchParams;
  const tercih = await aiTercihleriOku();
  const neredeHam =
    (sp.nerede || "").trim() || tercih.anaUs || tercih.sehir || "Ankara";
  const gunHam = Number(sp.gun);
  const gun = Number.isFinite(gunHam) && gunHam >= 2 && gunHam <= 7 ? gunHam : 3;
  const baslangic = ilBul(neredeHam);

  const adaylar = await planAdaylariniGetir();
  const planlar =
    baslangic != null ? seferPlanlariUret(baslangic, gun, adaylar) : [];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="sayfa-eyebrow">Sefer</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          Planlayıcı
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          Varıştan sonraki yükü sıralar. Aynı il veya yakın çıkış tercih edilir.
        </p>
      </div>

      <PlanForm key={`${neredeHam}|${gun}`} baslangic={neredeHam} gun={gun} />

      {baslangic && (
        <p className="text-sm font-medium text-paper/80">
          {baslangic} · {gun} gün
          {planlar.length > 0
            ? ` · ${planlar.length} alternatif`
            : " · uygun zincir aranıyor"}
        </p>
      )}

      {!baslangic && (
        <p className="text-sm font-semibold text-ember">
          Yer adı çözülemedi: «{neredeHam}». İl veya ilçe yaz.
        </p>
      )}

      {baslangic && planlar.length === 0 && (
        <div className="bos-durum">
          {baslangic} çıkışlı uygun zincir yok. Daha fazla ilan birikince veya
          gün sayısını artırınca dene.
        </div>
      )}

      {planlar.map((p, i) => (
        <PlanKarti key={i} plan={p} sira={i + 1} />
      ))}
    </div>
  );
}
