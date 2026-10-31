import KrediKartlari from "@/components/finans/KrediKartlari";
import { kartlarDurumu } from "@/lib/krediKarti";

export const dynamic = "force-dynamic";

export default async function KartlarSayfasi() {
  const kartlar = await kartlarDurumu();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="reveal">
        <p className="sayfa-eyebrow">Para</p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Kredi kartları</h1>
      </div>
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
        }))}
      />
    </div>
  );
}
