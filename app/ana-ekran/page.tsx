import AnaEkranRehber from "@/components/AnaEkranRehber";
import { pushAcikAnahtar } from "@/lib/bildirim/push";

export const dynamic = "force-dynamic";

export default function AnaEkranSayfasi() {
  return <AnaEkranRehber acikAnahtar={pushAcikAnahtar()} />;
}
