import { HareketKok } from "@/components/ana/Hareket";
import { anaYazi } from "@/components/ana/yazi";
import KrediGorunum from "@/components/kredi/KrediGorunum";
import { gunKaldi, krediDurumlari } from "@/lib/kredi";

export const dynamic = "force-dynamic";

const tarih = (d: Date) => d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default async function KredilerSayfasi() {
  const simdi = new Date();
  const krediler = await krediDurumlari(simdi);
  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
        <KrediGorunum
          krediler={krediler.map((k) => ({
            id: k.id,
            ad: k.ad,
            kurum: k.kurum,
            anapara: k.anapara,
            kalan: k.kalan,
            kalanAnapara: k.kalanAnapara,
            toplamFaiz: k.toplamFaiz,
            odenen: k.odenen,
            taksitSayisi: k.taksitSayisi,
            odenenTaksit: k.odenenTaksit,
            taksitler: k.taksitler.map((t) => ({
              id: t.id,
              sira: t.sira,
              vadeYazi: tarih(t.vade),
              tutar: t.tutar,
              anaparaPay: t.anaparaPay,
              faizPay: t.faizPay,
              odendi: t.odendi !== null,
              kalanGun: gunKaldi(t.vade, simdi),
            })),
          }))}
        />
      </HareketKok>
    </div>
  );
}
