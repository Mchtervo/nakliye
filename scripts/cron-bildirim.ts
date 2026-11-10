/**
 * Bağımsız bildirim kuyruğu — her 5 dk.
 *   npm run ts -- scripts/cron-bildirim.ts
 */
import { prisma } from "@/lib/prisma";
import { anaPrisma } from "@/lib/prismaAna";
import { uyeAdinaCalistir } from "@/lib/baglam";
import { uyeYukBildir } from "@/lib/bildirim/uyeYuk";
import {
  bekleyenBildirimleriIsle,
  BILDIRIM_TUR_LIMIT,
} from "@/lib/bildirim/gonder";

async function uyeleriBildir(): Promise<number> {
  const uyeler = await anaPrisma.uye.findMany({ where: { aktif: true, kurulumBitti: { not: null } }, select: { id: true } });
  let toplam = 0;
  for (const u of uyeler) {
    try {
      toplam += await uyeAdinaCalistir(u.id, uyeYukBildir);
    } catch (e) {
      console.error(`[cron-bildirim] üye ${u.id}`, e instanceof Error ? e.message : e);
    }
  }
  return toplam;
}

async function main() {
  const r = await bekleyenBildirimleriIsle(BILDIRIM_TUR_LIMIT);
  // Üyelere uygun yük (kendi koridoru / aracı / konumu)
  const uyeIlan = await uyeleriBildir().catch((e) => {
    console.error("[cron-bildirim] üyeler", e instanceof Error ? e.message : e);
    return 0;
  });
  console.log(
    JSON.stringify({
      ok: true,
      islenen: r.islenen ?? 0,
      telegram: r.telegram,
      push: r.push,
      uyeIlan,
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
