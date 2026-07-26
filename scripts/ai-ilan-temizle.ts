/**
 * Tüm YukIlani kayıtlarını siler (kalite testi öncesi temiz sayfa).
 * Kullanım: npm run ai:ilan-temizle
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const once = await prisma.yukIlani.count();
  const silinen = await prisma.yukIlani.deleteMany({});
  console.log(`YukIlani: ${once} → silinen ${silinen.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
