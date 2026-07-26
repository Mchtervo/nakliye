/**
 * Son test mesajlarının ilan ↔ ham kalite özeti (stdout).
 *   npm run ai:kalite
 */
import { prisma } from "@/lib/prisma";
import { testKaliteRaporu } from "@/lib/ai/testKalite";

async function main() {
  const kayit = await prisma.ayar.findUnique({
    where: { anahtar: "ai_test_son_idler" },
  });
  let idler: number[] = [];
  if (kayit?.deger) {
    try {
      idler = (JSON.parse(kayit.deger) as number[]).filter(
        (n) => Number.isFinite(n) && n > 0
      );
    } catch {
      idler = [];
    }
  }
  if (idler.length === 0) {
    const son = await prisma.hamMesaj.findMany({
      where: { islendi: true, denemeSayisi: { gt: 0 } },
      orderBy: { id: "desc" },
      take: 10,
      select: { id: true },
    });
    idler = son.map((m) => m.id);
  }

  console.log(`Mesaj id: ${idler.join(", ") || "(yok)"}`);
  console.log(await testKaliteRaporu(idler));

  // En çok rotalı mesajdan ham + ilan satırları
  for (const id of idler.slice(0, 3)) {
    const m = await prisma.hamMesaj.findUnique({
      where: { id },
      select: { id: true, metin: true },
    });
    if (!m) continue;
    const ilanlar = await prisma.yukIlani.findMany({
      where: { hamMetin: m.metin },
      orderBy: { id: "desc" },
      take: 8,
      select: {
        id: true,
        firmaAdi: true,
        telefon: true,
        nereden: true,
        nereye: true,
        cikisIl: true,
        varisIl: true,
        yuklemeTarihi: true,
      },
    });
    if (ilanlar.length < 2) continue;
    console.log(`\n======== HAM #${m.id} (ilk 500) ========`);
    console.log(m.metin.slice(0, 500));
    console.log(`======== İLANLAR (${ilanlar.length}) ========`);
    for (const i of ilanlar) {
      console.log(
        `#${i.id} ${i.cikisIl || i.nereden || "?"}→${i.varisIl || i.nereye || "?"} | tel=${i.telefon || "YOK"} | firma=${i.firmaAdi || "YOK"} | tar=${i.yuklemeTarihi?.toISOString().slice(0, 10) || "—"}`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
