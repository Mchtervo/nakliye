import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import AracGorunum from "@/components/arac/AracGorunum";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aracEtiketi } from "@/lib/aracTip";
import { belgeAdi, kalanGun } from "@/lib/belge";
import { prisma } from "@/lib/prisma";
import { kmOzeti } from "@/lib/seferKm";
import { yakitVerimi } from "@/lib/yakit";

export const dynamic = "force-dynamic";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function AracSayfasi() {
  const tercih = await aiTercihleriOku();
  const [araclar, o, yakit, belgeler] = await Promise.all([
    prisma.arac.findMany({ orderBy: { id: "asc" } }),
    kmOzeti(new Date(), tercih.anaUs || "Ankara").catch(() => null),
    yakitVerimi().catch(() => null),
    prisma.belge.findMany({ orderBy: { bitis: "asc" } }),
  ]);
  const simdi = new Date();
  const aktifId = araclar.find((a) => a.aktif)?.id ?? araclar[0]?.id;

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <AracGorunum
          v={{
            araclar: araclar.map((a) => ({
              id: a.id,
              etiket: aracEtiketi(a),
              plaka: a.plaka,
              sofor: a.sofor,
              aktif: a.id === aktifId,
              sinif: a.sinif,
              kasaTipi: a.kasaTipi,
              kapasiteTon: a.kapasiteTon,
              kasaUzunlukM: a.kasaUzunlukM,
            })),
            km: o && {
              buAy: o.buAy,
              tahminiSayac: o.tahminiSayac,
              kmSayac: o.arac?.kmSayac ?? null,
              kmTarihYazi: o.arac?.kmTarih ? o.arac.kmTarih.toLocaleDateString("tr-TR") : null,
              sonrakiBakimKm: o.sonrakiBakimKm,
              bakimaKalan: o.bakimaKalan,
              bakimAralikKm: o.arac?.bakimAralikKm ?? null,
              sonBakimKm: o.arac?.sonBakimKm ?? null,
              bilinmeyenSefer: o.bilinmeyenSefer,
            },
            yakit: yakit && { lt100: yakit.lt100, tlKm: yakit.tlKm, sonLt100: yakit.sonLt100, fazla: yakit.fazla, dolum: yakit.dolum },
            belgeler: belgeler.map((b) => ({
              id: b.id,
              ad: belgeAdi(b.tur, b.ad),
              bitisYazi: b.bitis.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
              bitisIso: iso(b.bitis),
              kalan: kalanGun(b.bitis, simdi),
            })),
          }}
        />
      </HareketKok>
    </div>
  );
}
