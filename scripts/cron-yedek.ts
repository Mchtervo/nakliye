/**
 * Günde 1 JSON yedek → ~/backups, 7 gün sakla.
 * Muhasebe + yük bulucu tabloları (Supabase şeması değişmez).
 */
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const SAKLA_GUN = 7;

async function main() {
  const klasor =
    process.env.YEDEK_DIR?.trim() ||
    path.join(process.env.HOME || "/home/yukavci", "backups");
  await mkdir(klasor, { recursive: true });

  const [
    firmalar,
    yukler,
    odemeler,
    giderler,
    ayarlar,
    ilanKaynaklari,
    yukIlanlari,
    hamMesajlar,
  ] = await Promise.all([
    prisma.firma.findMany(),
    prisma.yuk.findMany(),
    prisma.odeme.findMany(),
    prisma.gider.findMany(),
    prisma.ayar.findMany(),
    prisma.ilanKaynagi.findMany(),
    prisma.yukIlani.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.hamMesaj.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      take: 5000,
      orderBy: { id: "desc" },
    }),
  ]);

  // Hassas oturum anahtarlarını yedekten çıkar
  const ayarTemiz = ayarlar.map((a) =>
    /session|secret|token|key/i.test(a.anahtar)
      ? { ...a, deger: "[REDACTED]" }
      : a
  );

  const paket = {
    tarih: new Date().toISOString(),
    firmalar,
    yukler,
    odemeler,
    giderler,
    ayarlar: ayarTemiz,
    ilanKaynaklari,
    yukIlanlari,
    hamMesajlar,
  };

  const ad = `yukavci-${new Date().toISOString().slice(0, 10)}.json`;
  const yol = path.join(klasor, ad);
  await writeFile(yol, JSON.stringify(paket), "utf8");
  console.log(`[cron-yedek] yazıldı ${yol}`);

  const dosyalar = (await readdir(klasor))
    .filter((f) => f.startsWith("yukavci-") && f.endsWith(".json"))
    .sort();
  const silinecek = dosyalar.slice(0, Math.max(0, dosyalar.length - SAKLA_GUN));
  for (const f of silinecek) {
    await unlink(path.join(klasor, f));
    console.log(`[cron-yedek] silindi ${f}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
