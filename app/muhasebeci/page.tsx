import { prisma } from "@/lib/prisma";
import { tarihYaz } from "@/lib/para";
import { kategoriAdi } from "@/lib/sabitler";
import { ayAraligi } from "@/lib/tarih";
import MuhasebeciPaneli from "@/components/MuhasebeciPaneli";
import Link from "next/link";

export const revalidate = 30;

function ayEtiketYaz(yil: number, ay: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(yil, ay - 1, 1));
}

export default async function MuhasebeciSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string }>;
}) {
  const sp = await searchParams;
  const simdi = new Date();
  let yil = simdi.getFullYear();
  let ay = simdi.getMonth() + 1;

  if (sp.ay && /^\d{4}-\d{2}$/.test(sp.ay)) {
    const [y, a] = sp.ay.split("-").map(Number);
    if (a >= 1 && a <= 12) {
      yil = y;
      ay = a;
    }
  }

  const { bas, son } = ayAraligi(yil, ay);
  const seciliAy = `${yil}-${String(ay).padStart(2, "0")}`;

  const [ayar, giderler] = await Promise.all([
    prisma.ayar.findUnique({ where: { anahtar: "muhasebeci_telefon" } }),
    prisma.gider.findMany({
      where: {
        tarih: { gte: bas, lt: son },
        fisResmi: { not: null },
      },
      orderBy: [{ tarih: "desc" }, { id: "desc" }],
    }),
  ]);

  // Önceki / sonraki ay linkleri
  const onceki = new Date(yil, ay - 2, 1);
  const sonraki = new Date(yil, ay, 1);
  const oncekiAy = `${onceki.getFullYear()}-${String(onceki.getMonth() + 1).padStart(2, "0")}`;
  const sonrakiAy = `${sonraki.getFullYear()}-${String(sonraki.getMonth() + 1).padStart(2, "0")}`;

  const fisler = giderler
    .filter((g) => g.fisResmi)
    .map((g) => ({
      id: g.id,
      tarihYazi: tarihYaz(g.tarih),
      kategoriAd: kategoriAdi(g.kategori),
      aciklama: g.aciklama,
      toplamTutar: g.toplamTutar,
      fisResmi: g.fisResmi as string,
      gonderildi: g.gonderildi,
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 reveal">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber">
            Fiş paylaşımı
          </p>
          <h1 className="font-display text-3xl font-extrabold text-paper sm:text-4xl">
            Muhasebeciye Gönder
          </h1>
          <p className="mt-1 text-sm text-fog">
            Fiş fotoğraflarını seçip tek tıkla gönder
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-asphalt-2 p-1">
          <Link
            href={`/muhasebeci?ay=${oncekiAy}`}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
          >
            ←
          </Link>
          <span className="min-w-[9rem] text-center text-sm font-bold capitalize text-paper">
            {ayEtiketYaz(yil, ay)}
          </span>
          <Link
            href={`/muhasebeci?ay=${sonrakiAy}`}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fog hover:bg-white/5 hover:text-paper"
          >
            →
          </Link>
        </div>
      </div>

      <MuhasebeciPaneli
        baslangicTelefon={ayar?.deger ?? ""}
        fisler={fisler}
        ayEtiket={ayEtiketYaz(yil, ay)}
        seciliAy={seciliAy}
      />
    </div>
  );
}
