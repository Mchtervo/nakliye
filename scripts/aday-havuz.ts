/**
 * ADAY havuz kırılımı — anlık teşhis.
 *   npm run ts -- scripts/aday-havuz.ts
 */
import { prisma } from "@/lib/prisma";
import { adayHavuzOzeti } from "@/lib/kaynaklar/adayHavuz";
import { bugunAnahtar, elemeSayaclariOku } from "@/lib/kaynaklar/elemeSayac";

async function main() {
  const h = await adayHavuzOzeti();
  const gun = bugunAnahtar();
  const bas = new Date(`${gun}T00:00:00+03:00`);
  const eleme = await elemeSayaclariOku(gun);
  const hasatKayit = await prisma.ilanKaynagi.count({
    where: {
      tur: "TELEGRAM_UYE",
      hasatKaynak: { not: null },
      createdAt: { gte: bas },
    },
  });

  console.log(
    JSON.stringify(
      {
        aday: h,
        hasatBugun: {
          linkTaranan: eleme.HASAT_LINK ?? 0,
          yeniAday: eleme.HASAT_YENI ?? 0,
          zatenVar: eleme.HASAT_MEVCUT ?? 0,
          dbHasatKayit: hasatKayit,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
