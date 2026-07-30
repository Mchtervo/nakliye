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

  // Arşivleme burada (sayfa açılışında değil)
  try {
    const { eskiIlanlariArsivle, arsivdenCanlandir } = await import(
      "@/lib/ilanTazelik"
    );
    await arsivdenCanlandir();
    await eskiIlanlariArsivle();
  } catch (e) {
    console.warn("[cron-ai-kuyruk] arsiv", e);
  }

  const rapor = await kuyrugunuCoz(22);
  // dedupAtlanan her zaman görünsün (erken dönüşte de 0)
  console.log(
    JSON.stringify({
      islenen: rapor.islenen,
      yeniIlan: rapor.yeniIlan,
      dedupAtlanan: rapor.dedupAtlanan ?? 0,
      bildirilen: rapor.bildirilen,
      kalan: rapor.kalan,
      hata: rapor.hata,
      geceErtelendi: rapor.geceErtelendi,
      bolgeElenen: rapor.bolgeElenen,
      cagriSayisi: rapor.cagriSayisi,
      mesajIdler: rapor.mesajIdler,
    })
  );
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
    const mesaj = e instanceof Error ? e.stack || e.message : String(e);
    console.error(mesaj);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
