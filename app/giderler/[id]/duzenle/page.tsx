import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GiderForm from "@/components/GiderForm";
import { anaYazi } from "@/components/ana/yazi";
import { HareketKok } from "@/components/ana/Hareket";
import { kurustanGiris } from "@/lib/para";
import { veresiyeYerleri } from "@/lib/veresiye";
import { aracSecenekleri } from "@/lib/aktifArac";

export const dynamic = "force-dynamic";

function tarihInput(d: Date): string {
  const y = d.getFullYear();
  const a = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${a}-${g}`;
}

export default async function GiderDuzenleSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idHam } = await params;
  const id = Number(idHam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [gider, yerler, araclar] = await Promise.all([
    prisma.gider.findUnique({ where: { id } }),
    veresiyeYerleri().catch(() => []),
    aracSecenekleri(),
  ]);
  if (!gider) notFound();

  const tutarKurus = gider.kdvli
    ? gider.kdvDahilMi
      ? gider.toplamTutar
      : gider.netTutar
    : gider.toplamTutar;

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <HareketKok>
      <GiderForm
        baslik="Gideri düzenle"
        altBaslik="Gider kaydını güncelle"
        bugunTarih={tarihInput(gider.tarih)}
        baslangic={{
          id: gider.id,
          tarih: tarihInput(gider.tarih),
          kategori: gider.kategori,
          aciklama: gider.aciklama || "",
          tutarYazi: kurustanGiris(tutarKurus),
          kdvli: gider.kdvli,
          kdvDahilMi: gider.kdvDahilMi,
          litre: gider.litre != null ? String(gider.litre) : "",
          km: gider.km != null ? String(gider.km) : "",
          fisResmi: gider.fisResmi,
          odeme: gider.odeme,
          veresiyeYer: gider.veresiyeYer || "",
          aracId: gider.aracId,
        }}
        veresiyeYerleri={yerler}
        araclar={araclar}
      />
      </HareketKok>
    </div>
  );
}
