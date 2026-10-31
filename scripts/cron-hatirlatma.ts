/**
 * Yarım saatte bir: okuyucu kopuk mu + (09:00 sonrası günde bir) ödeme hatırlatma.
 *   npm run ts -- scripts/cron-hatirlatma.ts
 */
import { prisma } from "@/lib/prisma";
import {
  bakimHatirlat,
  belgeHatirlat,
  odemeHatirlat,
  okuyucuHatirlat,
  yakitHatirlat,
  yolculukKontrol,
  yolculukSor,
} from "@/lib/bildirim/hatirlatma";
import { ikonHatirlat } from "@/lib/bildirim/ikonGuncelleme";

async function main() {
  const okuyucu = await okuyucuHatirlat();
  const odeme = await odemeHatirlat();
  const ikon = await ikonHatirlat();
  const yolculuk = (await yolculukSor()) || (await yolculukKontrol());
  const bakim = await bakimHatirlat();
  const belge = await belgeHatirlat();
  const yakit = await yakitHatirlat();
  console.log(
    `[cron-hatirlatma] okuyucu=${okuyucu} odeme=${odeme.adet}${odeme.atlandi ? ` (${odeme.atlandi})` : ""} ikon=${ikon} yolculuk=${yolculuk} bakim=${bakim} belge=${belge} yakit=${yakit}`
  );
}

main()
  .catch((e) => {
    console.error("[cron-hatirlatma]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
