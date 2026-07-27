/**
 * Nano vs Luna A/B — aynı 10 ham mesaj, yan yana kalite tablosu.
 * DB'ye YukIlani YAZMAZ. AiCagri loglanır (maliyet ölçümü).
 *
 *   npm run ai:ab-nano-luna
 *
 * Aynı mesaj setini tekrarlamak için Ayar: ai_ab_mesaj_idler
 * Sıfırlamak: DELETE FROM "Ayar" WHERE anahtar='ai_ab_mesaj_idler';
 */
import { prisma } from "@/lib/prisma";
import { aiKapaliMi, aiTestBypassIle } from "@/lib/ai/istemci";
import {
  abMesajSec,
  modelIleCozumle,
  skorHesapla,
  tabloYaz,
} from "@/lib/ai/abKarsilastir";
import { testIzniVer } from "@/lib/ai/testIzin";
import { rotaSatirSayisi } from "@/lib/kaynaklar/onFiltre";

const NANO = "gpt-5.4-nano";
const LUNA = "gpt-5.6-luna";

async function calistir() {
  console.log("[ab] 10 mesaj seçiliyor…");
  const mesajlar = await abMesajSec(10);
  if (mesajlar.length === 0) {
    console.error("Ham mesaj yok.");
    process.exitCode = 1;
    return;
  }

  console.log(`[ab] Seçilen ${mesajlar.length} mesaj:`);
  for (const m of mesajlar) {
    console.log(
      `  #${m.id} ~${rotaSatirSayisi(m.metin)} rota · ${m.metin.length} karakter`
    );
  }

  console.log(`\n[ab] === ${NANO} ===`);
  const nanoRun = await modelIleCozumle(mesajlar, NANO, "nano");
  const nanoSkor = await skorHesapla(
    mesajlar,
    nanoRun.ilanlar,
    NANO,
    "nano",
    nanoRun.bas
  );

  // Kısa ara — AiCagri zaman penceresi karışmasın
  await new Promise((r) => setTimeout(r, 1500));

  console.log(`\n[ab] === ${LUNA} ===`);
  const lunaRun = await modelIleCozumle(mesajlar, LUNA, "luna");
  const lunaSkor = await skorHesapla(
    mesajlar,
    lunaRun.ilanlar,
    LUNA,
    "luna",
    lunaRun.bas
  );

  const tablo = tabloYaz(nanoSkor, lunaSkor);
  console.log(tablo);

  await prisma.ayar.upsert({
    where: { anahtar: "ai_ab_son_rapor" },
    create: { anahtar: "ai_ab_son_rapor", deger: tablo },
    update: { deger: tablo },
  });
  console.log("[ab] Rapor Ayar.ai_ab_son_rapor'a yazıldı.");
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY yok.");
    process.exitCode = 1;
    return;
  }

  // Tahmini: 10 msg × 2 model × ~$0.02–0.15 — tavan $0.40
  if (aiKapaliMi()) {
    console.log("[ab] AI_KAPALI=true — test izni ile çalışıyor (tavan $0.40).");
    await testIzniVer(60, 0.4);
    await aiTestBypassIle(() => calistir());
  } else {
    console.log(
      "[ab] AI açık — günlük bütçeden düşer. Tahmini toplam <$0.25."
    );
    await calistir();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
