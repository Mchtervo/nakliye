/**
 * AI_ARAMA (Search1API / OpenAI web) + genel WEB kaynaklarını rotasyonla tara.
 *   npm run ts -- scripts/cron-ai-tarama.ts [limit]
 */
import { prisma } from "@/lib/prisma";
import { kaynaklariTara } from "@/lib/kaynaklar/tarama";

async function main() {
  const limit = Number(process.argv[2] || 2);
  const rapor = await kaynaklariTara(Number.isFinite(limit) ? limit : 2);
  console.log(
    JSON.stringify({
      taranan: rapor.taranan,
      yeniIlan: rapor.yeniIlan,
      bildirilen: rapor.bildirilen,
      sureMs: rapor.sureMs,
    })
  );
  if (rapor.hatalar.length > 0) {
    console.error("[ai-tarama] hatalar:", rapor.hatalar.join(" | "));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
