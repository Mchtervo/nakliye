import AySonu from "@/components/finans/AySonu";
import { ayNetleri } from "@/lib/krediKarti";

/** Ana sayfa: ay sonu net kalan (veri sunucuda, hareket istemcide). Kartlar /kartlar'da. */
export default async function FinansKartlari() {
  const aylar = await ayNetleri(6).catch(() => []);
  return aylar.length > 0 ? <AySonu aylar={aylar} /> : null;
}
