/**
 * Yarım saatte bir: okuyucu kopuk mu + (09:00 sonrası günde bir) ödeme hatırlatma.
 *   npm run ts -- scripts/cron-hatirlatma.ts
 */
import { prisma } from "@/lib/prisma";
import { odemeHatirlat, okuyucuHatirlat } from "@/lib/bildirim/hatirlatma";

async function main() {
  const okuyucu = await okuyucuHatirlat();
  const odeme = await odemeHatirlat();
  console.log(
    `[cron-hatirlatma] okuyucu=${okuyucu} odeme=${odeme.adet}${odeme.atlandi ? ` (${odeme.atlandi})` : ""}`
  );
}

main()
  .catch((e) => {
    console.error("[cron-hatirlatma]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
