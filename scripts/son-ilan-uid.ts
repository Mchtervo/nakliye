/**
 * Son ilanlarda uid / hamMesajId / kaynakMesajId doğrula.
 * VPS: npm run ts -- scripts/son-ilan-uid.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const ilanlar = await prisma.yukIlani.findMany({
    orderBy: { id: "desc" },
    take: 15,
    select: {
      id: true,
      nereden: true,
      nereye: true,
      gonderenUserId: true,
      kaynakMesajId: true,
      hamMesajId: true,
      createdAt: true,
    },
  });

  console.log("id | rota | uid | hamMesajId | tgMsg | zaman");
  for (const i of ilanlar) {
    console.log(
      `${i.id} | ${(i.nereden || "?").slice(0, 12)}→${(i.nereye || "?").slice(0, 12)} | ` +
        `${i.gonderenUserId || "-"} | ${i.hamMesajId ?? "-"} | ${i.kaynakMesajId ?? "-"} | ` +
        i.createdAt.toISOString()
    );
  }

  const son = ilanlar[0];
  if (!son) {
    console.log("İlan yok.");
    return;
  }
  console.log("\n--- Son ilan kontrol ---");
  if (son.gonderenUserId && son.hamMesajId) {
    console.log("OK: uid + hamMesajId dolu → Bilgi Sor Telegram DM çalışır.");
  } else if (son.hamMesajId && !son.gonderenUserId) {
    console.log(
      "UYARI: hamMesajId var ama uid yok — HamMesaj.gonderenUserId boştu (daemon from=?)."
    );
  } else if (!son.hamMesajId) {
    console.log(
      "HATA: hamMesajId yok — deploy eski veya kayıt yolu bağ yazmıyor."
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
