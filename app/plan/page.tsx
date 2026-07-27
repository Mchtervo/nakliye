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
  if (n <= 1) return "bugün / 1. gün";
  return `${n}. gün`;
}

function PlanKarti({ plan, sira }: { plan: SeferPlani; sira: number }) {
  return (
    <article className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-paper">
          Alternatif {sira}
        </h2>
        <p className="text-sm font-semibold text-teal">
          net ~{tlYaz(Math.max(0, plan.netTahmini))}
        </p>
      </div>
      <p className="text-xs text-fog">
        Toplam {tlYaz(plan.toplamUcret)} · {plan.toplamKm} km · boş {plan.bosKm}{" "}
        km · {plan.ayaklar.length} ayak
      </p>

      <ol className="space-y-3">
        {plan.ayaklar.map((a, i) => {
          const rota = `${a.ilan.nereden || a.ilan.cikisIl} → ${a.ilan.nereye || a.ilan.varisIl}`;
          const gelir =
            a.ilan.ucret && a.ilan.ucret > 0
              ? tlYaz(a.ilan.ucret)
              : a.ilan.fiyatTon && a.ilan.tonaj
                ? `~${tlYaz(a.ilan.fiyatTon * a.ilan.tonaj)}`
                : "fiyat yok";
          return (
            <li
              key={`${a.ilan.id}-${i}`}
              className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-fog">
                    {gunYazi(a.gun)}
                    {a.bosKm > 0 ? ` · boş ${a.bosKm} km` : ""}
                  </p>
                  <p className="font-display text-base font-extrabold text-paper">
                    {rota}
                  </p>
                  <p className="text-sm text-fog">
                    {gelir}
                    {a.ilan.firmaAdi ? ` · ${a.ilan.firmaAdi}` : ""}
                    {` · %${a.ilan.guvenSkoru}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <BilgiSorButonu
                    ilanId={a.ilan.id}
                    telefon={a.ilan.telefon}
                    gonderenUserId={a.ilan.gonderenUserId}
                  />
                  <Link
                    href={`/ai/yukler?sekme=HEPSI&id=${a.ilan.id}`}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-fog hover:text-paper"
                  >
                    Aç
                  </Link>
                </div>
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
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Sefer
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">
          Planlayıcı
        </h1>
        <p className="mt-1 text-sm text-fog">
          Mevcut ilanlardan 2–4 ayaklı tur. Varış → sonraki çıkış aynı il veya
          ≤100 km; kâra göre sıralı.
        </p>
      </div>

      <PlanForm baslangic={neredeHam} gun={gun} />

      {!baslangic && (
        <p className="text-sm text-ember">
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
