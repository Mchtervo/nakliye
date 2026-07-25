import Link from "next/link";
import { prisma } from "@/lib/prisma";
import YukForm, { type YukFormHazirlik } from "@/components/YukForm";
import { bugunTarihStr } from "@/lib/tarih";

export const dynamic = "force-dynamic";

function metin(deger: string | string[] | undefined): string | undefined {
  if (typeof deger !== "string") return undefined;
  const temiz = deger.trim().slice(0, 120);
  return temiz || undefined;
}

export default async function YeniYukSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const firmalar = await prisma.firma.findMany({
    orderBy: { ad: "asc" },
    select: { id: true, ad: true },
  });

  const hazir: YukFormHazirlik = {
    nereden: metin(sp.nereden),
    nereye: metin(sp.nereye),
    firmaAdi: metin(sp.firma),
    tutarYazi: metin(sp.tutar),
    aciklama: metin(sp.aciklama),
  };
  const onDolgu = Object.values(hazir).some(Boolean);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
          Yeni sefer
        </p>
        <h1 className="font-display text-3xl font-extrabold text-paper">Yeni Yük</h1>
      </div>

      {onDolgu && (
        <div className="rounded-xl border border-teal/30 bg-teal/10 px-3 py-2.5 text-sm text-paper reveal">
          Bulunan ilandan dolduruldu. Kontrol et, gerekirse düzelt.
        </div>
      )}

      <div className="kart-paper p-4 sm:p-6 reveal reveal-d1">
        <YukForm
          firmalar={firmalar}
          bugunTarih={bugunTarihStr()}
          hazir={onDolgu ? hazir : undefined}
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
