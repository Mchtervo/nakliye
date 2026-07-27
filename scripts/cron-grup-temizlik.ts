/**
 * Keşiften sonra: ölü/alakasız grup adaylarını Telegram'da onaylat.
 *   npm run ts -- scripts/cron-grup-temizlik.ts
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { cikisOnayiIste } from "@/lib/kaynaklar/grupTemizlik";

async function main() {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) {
    console.log("[grup-temizlik] üye tarama kapalı — atlandı.");
    return;
  }

  const r = await cikisOnayiIste();
  console.log(
    JSON.stringify({
      ok: true,
      aday: r.aday,
      gonderildi: r.gonderildi,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
