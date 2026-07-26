/**
 * Takılan 10'luk testi öldür + durumu sıfırla.
 *   npm run ai:test-durdur
 */
import { execSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { TEST_DURUM_ANAHTAR } from "@/lib/ai/testOnMesaj";

async function main() {
  let olduren = 0;
  try {
    // Linux VPS: ai-test-on.ts sürecini öldür
    const out = execSync(
      "ps aux | grep -E 'ai-test-on\\.ts' | grep -v grep | awk '{print $2}'",
      { encoding: "utf8" }
    );
    for (const pid of out.split(/\s+/).filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGTERM");
        olduren += 1;
        console.log(`[ai-test-durdur] SIGTERM pid=${pid}`);
      } catch {
        /* yok */
      }
    }
  } catch {
    console.log("[ai-test-durdur] çalışan ai-test-on.ts yok (veya Windows).");
  }

  await prisma.ayar.upsert({
    where: { anahtar: TEST_DURUM_ANAHTAR },
    create: {
      anahtar: TEST_DURUM_ANAHTAR,
      deger: JSON.stringify({
        durum: "hata",
        sonuc: { hata: "Elle durduruldu." },
        bitisMs: Date.now(),
      }),
    },
    update: {
      deger: JSON.stringify({
        durum: "hata",
        sonuc: { hata: "Elle durduruldu." },
        bitisMs: Date.now(),
      }),
    },
  });

  console.log(
    `[ai-test-durdur] durum=hata yazıldı · öldürülen süreç: ${olduren}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
