import { notFound } from "next/navigation";
import FirmaGorunum from "@/components/kasa/FirmaGorunum";
import { prisma } from "@/lib/prisma";
import { tarihYaz } from "@/lib/para";
import { telefonGoster, telefonTelHref } from "@/lib/telefon";
import { whatsappMesajUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function FirmaDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idHam } = await params;
  const id = Number(idHam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const firma = await prisma.firma.findUnique({
    where: { id },
    include: {
      yukler: {
        include: { odemeler: { orderBy: [{ tarih: "desc" }, { id: "desc" }] } },
        orderBy: [{ tarih: "desc" }, { id: "desc" }],
      },
    },
  });
  if (!firma) notFound();

  return (
    <FirmaGorunum
      v={{
        id: firma.id,
        ad: firma.ad,
        telefonYazi: firma.telefon ? telefonGoster(firma.telefon) : null,
        telHref: firma.telefon ? telefonTelHref(firma.telefon) : null,
        waHref: firma.telefon ? whatsappMesajUrl(firma.telefon, "") : null,
        vergiNo: firma.vergiNo,
        telefonHam: firma.telefon,
        ilkKayitYazi: tarihYaz(firma.createdAt),
        seferler: firma.yukler.map((y) => ({
          id: y.id,
          nereden: y.nereden,
          nereye: y.nereye,
          tarihYazi: tarihYaz(y.tarih),
          aciklama: y.aciklama,
          toplam: y.toplamTutar,
          odenen: y.odemeler.reduce((t, o) => t + o.tutar, 0),
          odemeler: y.odemeler.map((o) => ({
            id: o.id,
            tarihIso: o.tarih.toISOString(),
            tarihYazi: tarihYaz(o.tarih),
            tutar: o.tutar,
            not: o.not,
          })),
        })),
      }}
    />
  );
}
