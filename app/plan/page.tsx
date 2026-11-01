import { aiTercihleriOku } from "@/lib/ayarlar";
import { ilBul } from "@/lib/iller";
import {
  planAdaylariniGetir,
  seferPlanlariUret,
} from "@/lib/seferPlan";
import PlanGorunum from "@/components/sefer/PlanGorunum";

export const dynamic = "force-dynamic";

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

  const adaylar = await planAdaylariniGetir({
    maxTonaj: tercih.maliyet.tonaj,
  });
  const planlar =
    baslangic != null
      ? seferPlanlariUret(baslangic, gun, adaylar, tercih.maliyet)
      : [];

  return <PlanGorunum neredeHam={neredeHam} baslangic={baslangic} gun={gun} planlar={planlar} />;
}
