import Link from "next/link";
import { prisma } from "@/lib/prisma";
import YukForm from "@/components/YukForm";
import { bugunTarihStr } from "@/lib/tarih";

export const revalidate = 30;

export default async function YeniYukSayfasi() {
  const firmalar = await prisma.firma.findMany({
    orderBy: { ad: "asc" },
    select: { id: true, ad: true },
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Yeni sefer
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Yeni Yük</h1>
      </div>
      <div className="kart-paper p-4 sm:p-6 reveal reveal-d1">
        <YukForm firmalar={firmalar} bugunTarih={bugunTarihStr()} />
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
