/**
 * DB bütçe kesme bayrağını kaldırır.
 *   npm run ai:butce-ac
 */
import { prisma } from "@/lib/prisma";
import {
  BUTCE_KESIM_ANAHTAR,
  butceKesildiMi,
  butceKesiminiAc,
  bugunHarcamaMikro,
} from "@/lib/ai/butce";
import { gunlukButceUsd, mikrodolarYaz } from "@/lib/ai/maliyet";

async function main() {
  const onceki = await prisma.ayar.findUnique({
    where: { anahtar: BUTCE_KESIM_ANAHTAR },
  });
  console.log(`Bayrak (önce): ${onceki?.deger ?? "(yok)"}`);
  console.log(`Limit: $${gunlukButceUsd().toFixed(2)}`);
  console.log(`Bugün harcama: ${mikrodolarYaz(await bugunHarcamaMikro())}`);

  await butceKesiminiAc();

  console.log(`Bayrak (sonra): kesildi=${await butceKesildiMi() ? "evet" : "hayır"}`);
  console.log("OK — bütçe kesmesi açıldı.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
