import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GiderForm from "@/components/GiderForm";
import { aiKullanilabilir } from "@/lib/ai/istemci";
import { kurustanGiris } from "@/lib/para";

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

  const gider = await prisma.gider.findUnique({ where: { id } });
  if (!gider) notFound();

  const tutarKurus = gider.kdvli
    ? gider.kdvDahilMi
      ? gider.toplamTutar
      : gider.netTutar
    : gider.toplamTutar;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Düzelt
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">
          Gideri Düzenle
        </h1>
      </div>
      <div className="kart-paper p-4 sm:p-6 reveal reveal-d1">
        <GiderForm
          bugunTarih={tarihInput(gider.tarih)}
          aiOcr={aiKullanilabilir()}
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
          }}
        />
      </div>
      <Link
        href="/giderler"
        className="block text-center text-sm font-medium text-fog transition-colors hover:text-amber"
      >
        ← Giderlere dön
      </Link>
    </div>
  );
}
