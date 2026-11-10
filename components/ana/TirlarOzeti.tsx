import TirKartlari from "@/components/ana/TirKartlari";
import { ayAraligi } from "@/lib/tarih";
import { tirBazliOzet, tirToplami } from "@/lib/tirOzet";

/** Ana sayfa: bu ay her tırın (şoförün) gelir / gider / kâr / KDV'si + tüm tırların toplamı. */
export default async function TirlarOzeti() {
  const simdi = new Date();
  const { bas, son } = ayAraligi(simdi.getFullYear(), simdi.getMonth() + 1);
  const tirlar = await tirBazliOzet(bas, son).catch(() => []);
  if (tirlar.length === 0) return null;
  return <TirKartlari tirlar={tirlar} toplam={tirlar.length > 1 ? tirToplami(tirlar) : null} />;
}
