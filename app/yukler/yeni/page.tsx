import { prisma } from "@/lib/prisma";
import YukForm, { type YukFormHazirlik } from "@/components/YukForm";
import { anaYazi } from "@/components/ana/yazi";
import { bugunTarihStr } from "@/lib/tarih";
import { aracSecenekleri } from "@/lib/aktifArac";

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
  const [firmalar, araclar] = await Promise.all([
    prisma.firma.findMany({
      orderBy: { ad: "asc" },
      select: { id: true, ad: true },
    }),
    aracSecenekleri(),
  ]);

  const hazir: YukFormHazirlik = {
    nereden: metin(sp.nereden),
    nereye: metin(sp.nereye),
    firmaAdi: metin(sp.firma),
    tutarYazi: metin(sp.tutar),
    aciklama: metin(sp.aciklama),
  };
  const onDolgu = Object.values(hazir).some(Boolean);

  return (
    <div className={`ana ${anaYazi.variable}`}>
      <YukForm
        baslik="Yeni sefer"
        altBaslik="Sefer bilgilerini gir"
        firmalar={firmalar}
        araclar={araclar}
        bugunTarih={bugunTarihStr()}
        hazir={onDolgu ? hazir : undefined}
        ust={
          onDolgu ? (
            <p className="rounded-2xl bg-[#dcfce7] px-3 py-2.5 text-[13px] font-semibold text-[#166534]">
              Bulunan ilandan dolduruldu. Kontrol et, gerekirse düzelt.
            </p>
          ) : undefined
        }
      />
    </div>
  );
}
