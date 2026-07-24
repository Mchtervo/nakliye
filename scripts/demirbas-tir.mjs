import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tutarKurus = 167_000_000; // 1.670.000 TL KDV dahil
const toplamTutar = tutarKurus;
const netTutar = Math.round(toplamTutar / 1.2);
const kdvTutar = toplamTutar - netTutar;

const mevcut = await prisma.gider.findFirst({
  where: {
    kategori: "DEMIRBAS",
    toplamTutar,
    aciklama: { contains: "1.670.000" },
  },
});

if (mevcut) {
  console.log("Zaten var, id:", mevcut.id);
} else {
  const kayit = await prisma.gider.create({
    data: {
      tarih: new Date(),
      kategori: "DEMIRBAS",
      aciklama: "Tır alımı · 1.670.000 TL (KDV dahil)",
      kdvli: true,
      kdvDahilMi: true,
      netTutar,
      kdvTutar,
      toplamTutar,
    },
  });
  console.log("OK demirbaş id=", kayit.id, "net=", netTutar, "kdv=", kdvTutar);
}

await prisma.$disconnect();
