/**
 * Çöp ADAY'ları katilimRedSebebi ile PASİF yap.
 *   npm run ts -- scripts/aday-red-temizle.ts
 */
import { prisma } from "@/lib/prisma";
import { katilimRedSebebi } from "@/lib/bolgeler";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

async function main() {
  const adaylar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, durum: "ADAY" },
    select: { id: true, ad: true, aktif: true },
  });
  let red = 0;
  for (const a of adaylar) {
    const sebep = katilimRedSebebi(a.ad);
    if (!sebep) continue;
    await prisma.ilanKaynagi.update({
      where: { id: a.id },
      data: {
        aktif: false,
        durum: "PASIF",
        sonHata: `Katılım RED: ${sebep}`.slice(0, 300),
      },
    });
    red += 1;
    console.log(`PASIF #${a.id} (${sebep}): ${a.ad}`);
  }
  console.log(`Toplam ADAY=${adaylar.length} RED→PASIF=${red}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
