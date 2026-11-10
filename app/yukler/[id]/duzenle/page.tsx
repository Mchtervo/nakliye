import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import YukForm from "@/components/YukForm";
import { anaYazi } from "@/components/ana/yazi";
import { kurustanGiris } from "@/lib/para";
import { aracSecenekleri } from "@/lib/aktifArac";

export const dynamic = "force-dynamic";

function tarihInput(d: Date): string {
  const y = d.getFullYear();
  const a = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${a}-${g}`;
}

export default async function YukDuzenleSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idHam } = await params;
  const id = Number(idHam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [yuk, firmalar, araclar] = await Promise.all([
    prisma.yuk.findUnique({ where: { id } }),
    prisma.firma.findMany({
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    }),
    aracSecenekleri(),
  ]);
  if (!yuk) notFound();

  const tutarKurus = yuk.kdvli
    ? yuk.kdvDahilMi
      ? yuk.toplamTutar
      : yuk.netTutar
    : yuk.toplamTutar;

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <YukForm
        baslik="Seferi düzenle"
        altBaslik={`${yuk.nereden} → ${yuk.nereye}`}
        firmalar={firmalar}
        araclar={araclar}
        bugunTarih={tarihInput(yuk.tarih)}
        baslangic={{
          id: yuk.id,
          tarih: tarihInput(yuk.tarih),
          firmaId: yuk.firmaId,
          nereden: yuk.nereden,
          nereye: yuk.nereye,
          aciklama: yuk.aciklama || "",
          tutarYazi: kurustanGiris(tutarKurus),
          kdvli: yuk.kdvli,
          kdvDahilMi: yuk.kdvDahilMi,
          km: yuk.km != null ? String(yuk.km) : "",
          aracId: yuk.aracId,
        }}
      />
    </div>
  );
}
