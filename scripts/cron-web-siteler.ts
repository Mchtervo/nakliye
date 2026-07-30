/**
 * Kayıtlı web sitelerini tara (yuklegel + ileride eklenenler).
 *   npm run ts -- scripts/cron-web-siteler.ts
 */
import { prisma } from "@/lib/prisma";
import { aktifSiteleriTara } from "@/lib/kaynaklar/siteler/kayit";

async function main() {
  const turlar = await aktifSiteleriTara();
  for (const t of turlar) {
    if (t.atlandi) {
      console.log(`[${t.slug}] atlandı: ${t.neden}`);
      continue;
    }
    const r = t.rapor!;
    console.log(
      JSON.stringify({
        slug: t.slug,
        ok: r.hatalar.length === 0 || r.kayit > 0,
        kayit: r.kayit,
        ...Object.fromEntries(
          Object.entries(r).filter(([k]) => k !== "hatalar" && k !== "kayit")
        ),
      })
    );
    if (r.hatalar.length > 0) {
      console.error(`[${t.slug}] hatalar:`, r.hatalar.join(" | "));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
