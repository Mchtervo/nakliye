import AcikKabuk from "@/components/AcikKabuk";
import AnaEkranRehber from "@/components/AnaEkranRehber";
import { pushAcikAnahtar } from "@/lib/bildirim/push";

export const dynamic = "force-dynamic";

function AnaEkranSayfasiIcerik() {
  return <AnaEkranRehber acikAnahtar={pushAcikAnahtar()} />;
}

/** Yeni görünüm: lacivert başlık + açık tema (içerik aynı) */
export default async function AnaEkranSayfasi(...args: Parameters<typeof AnaEkranSayfasiIcerik>) {
  return <AcikKabuk>{await AnaEkranSayfasiIcerik(...args)}</AcikKabuk>;
}
