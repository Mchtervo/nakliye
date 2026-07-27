/**
 * HamMesaj kuyruğunu AI ile çözer.
 * AI_KAPALI=true iken API erken döner (OpenAI yok).
 * Bütçe kesikken sessiz atlar; günde bir hatırlatma.
 */
import { prisma } from "@/lib/prisma";
import { kuyrugaBakim, kuyrugunuCoz } from "@/lib/kaynaklar/telegramUye";
import { aiKapaliMi } from "@/lib/ai/istemci";
import { butceKesikHatirlat, butceMusaitMi } from "@/lib/ai/butce";

async function main() {
  if (aiKapaliMi()) {
    console.log("[cron-ai-kuyruk] AI_KAPALI=true — atlandı.");
    return;
  }

  // Limit yükseldi / yeni gün → bayrak burada senkronize olur.
  if (!(await butceMusaitMi())) {
    const kalan = await prisma.hamMesaj.count({ where: { islendi: false } });
    await butceKesikHatirlat(kalan);
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
