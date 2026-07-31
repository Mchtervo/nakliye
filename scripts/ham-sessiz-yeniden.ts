/**
 * Bugün islendi=true + hata=null kalan (sessiz kapanmış) koridor adaylarını
 * yeniden AI kuyruğuna alır. Bir kerelik / ihtiyaç halinde:
 *   npm run ts -- scripts/ham-sessiz-yeniden.ts
 * Dry-run: npm run ts -- scripts/ham-sessiz-yeniden.ts --dry
 */
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { illeriBul } from "@/lib/iller";
import { koridorIlKumesi } from "@/lib/koridor";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";
import { elemeSebebi } from "@/lib/kaynaklar/onFiltre";

async function main() {
  const dry = process.argv.includes("--dry");
  const gun = bugunAnahtar();
  const bas = new Date(`${gun}T00:00:00+03:00`);
  const bit = new Date(bas.getTime() + 24 * 60 * 60 * 1000);

  const tercih = await aiTercihleriOku();
  const hedef = new Set(koridorIlKumesi(tercih.koridorIller));

  const sessiz = await prisma.hamMesaj.findMany({
    where: {
      createdAt: { gte: bas, lt: bit },
      islendi: true,
      hata: null,
    },
    select: { id: true, metin: true, denemeSayisi: true, kaynakId: true },
    orderBy: { id: "asc" },
  });

  // Ön filtre geçer + en az bir koridor ili (CIS/spam sinyal kaçaklarını ele)
  const adaylar = sessiz.filter((m) => {
    if (elemeSebebi(m.metin, hedef) !== null) return false;
    return illeriBul(m.metin).some((il) => hedef.has(il));
  });
  const idler = adaylar.map((a) => a.id);

  console.log(
    JSON.stringify(
      {
        gun,
        sessizToplam: sessiz.length,
        koridorAday: adaylar.length,
        dry,
        ornek: adaylar.slice(0, 12).map((a) => ({
          id: a.id,
          kaynakId: a.kaynakId,
          deneme: a.denemeSayisi,
          metin: a.metin.slice(0, 90).replace(/\s+/g, " "),
        })),
      },
      null,
      2
    )
  );

  if (dry || idler.length === 0) return;

  const sonuc = await prisma.hamMesaj.updateMany({
    where: { id: { in: idler } },
    data: {
      islendi: false,
      hata: null,
      denemeSayisi: 0,
    },
  });
  console.log(
    JSON.stringify({ yenidenKuyruk: sonuc.count, not: "islendi=false — ai-kuyruk alacak" })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
