/**
 * Haftalık: uid'li HamMesaj / telefon yayılımı → YukIlani.
 * npm run ts -- scripts/cron-uid-doldur.ts
 * Dry-run: npm run ts -- scripts/cron-uid-doldur.ts --dry
 */
import { uidGeriyeDonukDoldur } from "@/lib/kaynaklar/uidDoldur";
import { prisma } from "@/lib/prisma";

async function main() {
  const dry = process.argv.includes("--dry");
  const sonuc = await uidGeriyeDonukDoldur({ yaz: !dry });
  console.log(
    `[uid-doldur] ${dry ? "DRY-RUN" : "YAZ"} ` +
      `hamEşleşti=${sonuc.hamEslesti} telYayılım=${sonuc.telefonYayildi} ` +
      `uidHam=${sonuc.uidLiHam} ilanUid ${sonuc.uidLiIlanOnce}→${sonuc.uidLiIlanSonra}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
