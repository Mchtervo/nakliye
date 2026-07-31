/**
 * "13.60 tır" yanlışlıkla 13,60 TL (1360 kuruş) kaydedilmiş fiyatları temizler.
 *   npm run ts -- scripts/fiyat-1360-temizle.ts
 * Dry-run: npm run ts -- scripts/fiyat-1360-temizle.ts --dry
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const dry = process.argv.includes("--dry");
  const where = {
    OR: [{ ucret: 1360 }, { fiyatTon: 1360 }],
  };

  const adet = await prisma.yukIlani.count({ where });
  const ornek = await prisma.yukIlani.findMany({
    where,
    select: {
      id: true,
      ucret: true,
      fiyatTon: true,
      cikisIl: true,
      varisIl: true,
      aracTipi: true,
      hamMetin: true,
    },
    take: 15,
  });

  console.log(
    JSON.stringify(
      {
        adet,
        dry,
        ornek: ornek.map((o) => ({
          id: o.id,
          ucret: o.ucret,
          fiyatTon: o.fiyatTon,
          rota: `${o.cikisIl}→${o.varisIl}`,
          metin: o.hamMetin.slice(0, 80).replace(/\s+/g, " "),
        })),
      },
      null,
      2
    )
  );

  if (dry || adet === 0) return;

  const sonuc = await prisma.yukIlani.updateMany({
    where,
    data: {
      ucret: null,
      fiyatTon: null,
      fiyatBelirsiz: true,
      aracUzunluk: 13.6,
      aracTipiKod: "TENTELI",
    },
  });
  console.log(JSON.stringify({ temizlenen: sonuc.count, aracUzunluk: 13.6 }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
