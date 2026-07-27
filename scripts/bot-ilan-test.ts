/**
 * Bot ilanAra — ilçe/şehir çözümleme doğrulama (OpenAI yok).
 *   npm run ts -- scripts/bot-ilan-test.ts
 */
import { prisma } from "@/lib/prisma";
import { ilanAra } from "@/lib/bot/araclar";
import { ilBul, illeriBul } from "@/lib/iller";

const SORULAR = [
  "ankaradayım boluya yük var mı",
  "gerede çıkışlı",
  "ostimden gebzeye",
  "hadımköy yük",
  "yahşihan",
];

async function main() {
  console.log("═══ ilBul / illeriBul ═══");
  for (const s of [
    "Ankara",
    "Bolu",
    "Gerede",
    "Ostim",
    "Gebze",
    "Hadımköy",
    "Yahşihan",
    "İskitler",
  ]) {
    console.log(`  ${s} → ${ilBul(s) || "(yok)"}`);
  }

  console.log("\n═══ Soru metninden iller ═══");
  for (const q of SORULAR) {
    console.log(`  "${q}" → [${illeriBul(q).join(", ")}]`);
  }

  console.log("\n═══ ilanAra (son 48s) ═══");
  const testler: { cikisIl?: string; varisIl?: string; etiket: string }[] = [
    { cikisIl: "Ankara", varisIl: "Bolu", etiket: "Ankara→Bolu" },
    { cikisIl: "Gerede", etiket: "Gerede (→Bolu) çıkış" },
    { cikisIl: "Ostim", etiket: "Ostim (→Ankara) çıkış" },
    { varisIl: "Gebze", etiket: "Gebze (→Kocaeli) varış" },
    { cikisIl: "Ankara", varisIl: "İstanbul", etiket: "Ankara→İstanbul" },
  ];

  for (const t of testler) {
    const cikisN = t.cikisIl ? ilBul(t.cikisIl) : null;
    const varisN = t.varisIl ? ilBul(t.varisIl) : null;
    const r = await ilanAra({
      cikisIl: t.cikisIl,
      varisIl: t.varisIl,
      sonSaat: 48,
      limit: 3,
    });
    console.log(
      `  ${t.etiket} [DB: ${cikisN || "*"}→${varisN || "*"}] → ${r.toplam} ilan`
    );
    for (const i of r.ilanlar) {
      console.log(
        `    #${i.id} ${i.cikisIl}→${i.varisIl} · ${i.nereden || "?"}→${i.nereye || "?"} · ${i.telefon || "telsiz"}`
      );
    }
  }

  // "ankaradayım boluya" simülasyonu: illeriBul + ilanAra
  const ornek = "ankaradayım boluya yük var mı";
  const iller = illeriBul(ornek);
  console.log(`\n═══ Simülasyon: "${ornek}" ═══`);
  console.log(`  illeriBul: ${iller.join(", ")}`);
  if (iller.length >= 2) {
    const r = await ilanAra({
      cikisIl: iller[0],
      varisIl: iller[iller.length - 1],
      sonSaat: 48,
      limit: 5,
    });
    console.log(`  ilanAra(${iller[0]}→${iller[iller.length - 1]}): ${r.toplam}`);
    for (const i of r.ilanlar) {
      console.log(`    #${i.id} ${i.cikisIl}→${i.varisIl}`);
    }
  } else if (iller.length === 1) {
    const r = await ilanAra({ cikisIl: iller[0], sonSaat: 48, limit: 5 });
    console.log(`  ilanAra(çıkış=${iller[0]}): ${r.toplam}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
