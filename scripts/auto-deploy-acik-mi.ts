/**
 * Auto-deploy açık mı? exit 0 = açık, 1 = kapalı.
 * Bash: npm run ts -- scripts/auto-deploy-acik-mi.ts
 *
 * Öncelik: AUTO_DEPLOY=1|true|yes|on → her zaman açık (panel/DB kilitlenmesin).
 * Yoksa DB auto_deploy=1.
 */
import { AYAR_ANAHTARLARI, ayarOku, autoDeployEnvAcikMi } from "@/lib/ayarlar";
import { prisma } from "@/lib/prisma";

async function main() {
  if (autoDeployEnvAcikMi()) {
    console.log("auto_deploy=açık (AUTO_DEPLOY env)");
    process.exit(0);
  }

  const v = await ayarOku(AYAR_ANAHTARLARI.autoDeploy);
  const acik = v === "1";
  console.log(acik ? "auto_deploy=açık (db)" : "auto_deploy=kapalı");
  process.exit(acik ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
