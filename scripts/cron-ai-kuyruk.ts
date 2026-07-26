/**
 * HamMesaj kuyruğunu AI ile çözer.
 * AI_KAPALI=true iken API erken döner (OpenAI yok).
 */
import { prisma } from "@/lib/prisma";
import { kuyrugaBakim, kuyrugunuCoz } from "@/lib/kaynaklar/telegramUye";
import { aiKapaliMi } from "@/lib/ai/istemci";

async function main() {
  if (aiKapaliMi()) {
    console.log("[cron-ai-kuyruk] AI_KAPALI=true — atlandı.");
    return;
  }
  const rapor = await kuyrugunuCoz(22);
  console.log(JSON.stringify(rapor));
  if (rapor.kalan === 0) {
    try {
      await kuyrugaBakim();
    } catch (e) {
      console.warn("[cron-ai-kuyruk] bakim", e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
