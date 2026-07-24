import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import YukForm from "@/components/YukForm";
import { kurustanGiris } from "@/lib/para";

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

  const [yuk, firmalar] = await Promise.all([
    prisma.yuk.findUnique({ where: { id } }),
    prisma.firma.findMany({
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    }),
  ]);
  if (!yuk) notFound();

  const tutarKurus = yuk.kdvli
    ? yuk.kdvDahilMi
      ? yuk.toplamTutar
      : yuk.netTutar
    : yuk.toplamTutar;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Düzelt
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">
          Yükü Düzenle
        </h1>
        <p className="mt-1 text-sm text-fog">
          {yuk.nereden} → {yuk.nereye}
        </p>
      </div>
      <div className="kart-paper p-4 sm:p-6 reveal reveal-d1">
        <YukForm
          firmalar={firmalar}
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
          }}
        />
      </div>
      <Link
        href="/yukler"
        className="block text-center text-sm font-medium text-fog transition-colors hover:text-amber"
      >
        ← Yüklere dön
      </Link>
    </div>
  );
}
