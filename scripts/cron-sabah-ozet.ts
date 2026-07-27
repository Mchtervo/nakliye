/**
 * Sessiz saatte biriken ilanların sabah özeti (07:05 TR).
 */
import { prisma } from "@/lib/prisma";
import { sabahOzetBildir } from "@/lib/bildirim/gonder";

async function main() {
  const r = await sabahOzetBildir();
  console.log(
    `[cron-sabah-ozet] adet=${r.adet} gonderildi=${r.gonderildi}`
  );
}

main()
  .catch((e) => {
    console.error("[cron-sabah-ozet]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
