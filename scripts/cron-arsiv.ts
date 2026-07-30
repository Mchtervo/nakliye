/**
 * 48 saatten eski ilanları ARSIV'e alır (silmez).
 * Cron: 06:00 Europe/Istanbul.
 */
import { prisma } from "@/lib/prisma";
import { eskiIlanlariArsivle } from "@/lib/ilanTazelik";

async function main() {
  const n = await eskiIlanlariArsivle();
  console.log(JSON.stringify({ ok: true, arsivlenen: n }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
