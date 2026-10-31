import AySonu from "@/components/finans/AySonu";
import KrediKartlari from "@/components/finans/KrediKartlari";
import { ayNetleri, kartlarDurumu } from "@/lib/krediKarti";

/** Ana sayfa: ay sonu net kalan + kredi kartları (veri sunucuda, hareket istemcide). */
export default async function FinansKartlari() {
  const [aylar, kartlar] = await Promise.all([ayNetleri(6).catch(() => []), kartlarDurumu().catch(() => [])]);
  return (
    <>
      {aylar.length > 0 && <AySonu aylar={aylar} />}
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
    </>
  );
}
