/**
 * Bağımsız bildirim kuyruğu — her 5 dk.
 *   npm run ts -- scripts/cron-bildirim.ts
 */
import { prisma } from "@/lib/prisma";
import {
  bekleyenBildirimleriIsle,
  BILDIRIM_TUR_LIMIT,
} from "@/lib/bildirim/gonder";

async function main() {
  const r = await bekleyenBildirimleriIsle(BILDIRIM_TUR_LIMIT);
  console.log(
    JSON.stringify({
      ok: true,
      islenen: r.islenen ?? 0,
      telegram: r.telegram,
      push: r.push,
      ertelenen: r.ertelenen,
      atlanan: r.atlanan,
      vazgecilen: r.vazgecilen ?? 0,
      hatalar: r.hatalar.slice(0, 5),
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
