/**
 * yuklegel.com firma+numara hasadı — 2 saatte bir.
 *   npm run ts -- scripts/cron-yuklegel.ts
 */
import { prisma } from "@/lib/prisma";
import { yuklegelTara } from "@/lib/kaynaklar/yuklegel";

async function main() {
  const r = await yuklegelTara();
  console.log(JSON.stringify({ ok: true, ...r }));
  if (r.hatalar.length > 0) {
    console.error("[yuklegel] hatalar:", r.hatalar.join(" | "));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
