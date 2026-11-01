import KrediKartlari from "@/components/finans/KrediKartlari";
import { kartlarDurumu } from "@/lib/krediKarti";

export const dynamic = "force-dynamic";

export default async function KartlarSayfasi() {
  const kartlar = await kartlarDurumu();
  return (
    <KrediKartlari
      kartlar={kartlar.map((k) => ({
        id: k.id,
        ad: k.ad,
        sonOdemeGunu: k.sonOdemeGunu,
        borc: k.borc,
        odenen: k.odenen,
        kalan: k.kalan,
        sonOdemeIso: k.sonOdeme.toISOString(),
        kalanGun: k.kalanGun,
        odemeler: k.odemeler.map((o) => ({ id: o.id, tarihIso: o.tarih.toISOString(), tutar: o.tutar })),
      }))}
    />
  );
}
