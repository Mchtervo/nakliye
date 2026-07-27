/**
 * Teşhis: HamMesaj ↔ YukIlani bağları, uid, metin örtüşmesi.
 * npm run ts -- scripts/uid-bag-teshis.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const hamlar = await prisma.hamMesaj.findMany({
    select: {
      id: true,
      kaynakId: true,
      mesajId: true,
      gonderenUserId: true,
      metin: true,
      createdAt: true,
      islendi: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const ilanlar = await prisma.yukIlani.findMany({
    select: {
      id: true,
      kaynakId: true,
      kaynakMesajId: true,
      gonderenUserId: true,
      hamMetin: true,
      createdAt: true,
      nereden: true,
      nereye: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log("=== Son 10 HamMesaj ===");
  for (const h of hamlar.slice(0, 10)) {
    console.log(
      `#${h.id} kaynak=${h.kaynakId} tgMsg=${h.mesajId} uid=${h.gonderenUserId || "-"} islendi=${h.islendi} len=${h.metin.length} | ${h.metin.slice(0, 60).replace(/\n/g, " ")}`
    );
  }

  console.log("\n=== Son 10 YukIlani ===");
  for (const i of ilanlar.slice(0, 10)) {
    console.log(
      `#${i.id} ${i.nereden}→${i.nereye} kaynak=${i.kaynakId} kaynakMesajId=${i.kaynakMesajId} uid=${i.gonderenUserId || "-"} len=${i.hamMetin.length} | ${i.hamMetin.slice(0, 60).replace(/\n/g, " ")}`
    );
  }

  const hamUid = await prisma.hamMesaj.count({
    where: { gonderenUserId: { not: null } },
  });
  const hamMesajIdVar = await prisma.hamMesaj.count({
    where: { mesajId: { not: null } },
  });
  const ilanUid = await prisma.yukIlani.count({
    where: { gonderenUserId: { not: null } },
  });
  const ilanMesajId = await prisma.yukIlani.count({
    where: { kaynakMesajId: { not: null } },
  });

  console.log("\n=== Özet ===");
  console.log(`HamMesaj mesajId dolu: ${hamMesajIdVar}, uid dolu: ${hamUid}`);
  console.log(
    `YukIlani kaynakMesajId dolu: ${ilanMesajId}, uid dolu: ${ilanUid}`
  );

  // Metin örtüşme denemesi (ilk 5 ilan)
  let eslesen = 0;
  for (const i of ilanlar.slice(0, 15)) {
    const a = i.hamMetin.trim();
    const ham = await prisma.hamMesaj.findFirst({
      where: {
        OR: [
          { metin: a },
          ...(i.kaynakId
            ? [{ kaynakId: i.kaynakId, metin: { startsWith: a.slice(0, 80) } }]
            : []),
        ],
      },
      select: { id: true, mesajId: true, gonderenUserId: true, metin: true },
    });
    if (ham) {
      eslesen += 1;
      console.log(
        `metin eşleşti ilan #${i.id} ↔ ham #${ham.id} tgMsg=${ham.mesajId} uid=${ham.gonderenUserId || "-"}`
      );
    } else {
      // neden: prefix karşılaştır
      const ornek = await prisma.hamMesaj.findFirst({
        where: i.kaynakId ? { kaynakId: i.kaynakId } : {},
        orderBy: { createdAt: "desc" },
        select: { id: true, metin: true },
      });
      if (ornek) {
        const a80 = a.slice(0, 80);
        const b80 = ornek.metin.slice(0, 80);
        console.log(
          `metin YOK ilan #${i.id} | ilan80="${a80.replace(/\n/g, " ")}" | ham#${ornek.id}80="${b80.replace(/\n/g, " ")}"`
        );
      }
    }
  }
  console.log(`Metin eşleşen (örnek 15): ${eslesen}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
