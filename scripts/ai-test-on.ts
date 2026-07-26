/**
 * 10 mesajlık AI test — API'den detached spawn ile çalışır.
 * (Next response sonrası void promise ölmesin diye.)
 */
import { prisma } from "@/lib/prisma";
import {
  aiTestOnMesajCalistir,
  TEST_DURUM_ANAHTAR,
} from "@/lib/ai/testOnMesaj";

async function durumYaz(deger: unknown) {
  await prisma.ayar.upsert({
    where: { anahtar: TEST_DURUM_ANAHTAR },
    create: { anahtar: TEST_DURUM_ANAHTAR, deger: JSON.stringify(deger) },
    update: { deger: JSON.stringify(deger) },
  });
}

async function main() {
  console.log("[ai-test-on] başladı");
  const sonuc = await aiTestOnMesajCalistir();
  const bitisMs = Date.now();
  if ("hata" in sonuc) {
    await durumYaz({ durum: "hata", sonuc, bitisMs });
    console.error("[ai-test-on] hata:", sonuc.hata.slice(0, 200));
    process.exitCode = 1;
  } else {
    await durumYaz({ durum: "bitti", sonuc, bitisMs });
    console.log("[ai-test-on] bitti");
  }
}

main()
  .catch(async (e) => {
    console.error("[ai-test-on]", e);
    await durumYaz({
      durum: "hata",
      sonuc: { hata: e instanceof Error ? e.message : "Test çöktü" },
      bitisMs: Date.now(),
    }).catch(() => null);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
