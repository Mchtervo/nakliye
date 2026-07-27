/**
 * Auto-deploy açık mı? exit 0 = açık, 1 = kapalı.
 * Bash: npm run ts -- scripts/auto-deploy-acik-mi.ts
 */
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { prisma } from "@/lib/prisma";

async function main() {
  const v = await ayarOku(AYAR_ANAHTARLARI.autoDeploy);
  // Varsayılan kapalı — Ayarlar'dan açılmalı
  const acik = v === "1";
  console.log(acik ? "auto_deploy=açık" : "auto_deploy=kapalı");
  process.exit(acik ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
