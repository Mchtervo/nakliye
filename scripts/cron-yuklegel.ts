/**
 * yuklegel.com firma+numara hasadı — günde 3 (08/14/20).
 *   npm run ts -- scripts/cron-yuklegel.ts
 */
import { prisma } from "@/lib/prisma";
import { yuklegelTara } from "@/lib/kaynaklar/yuklegel";

async function main() {
  const r = await yuklegelTara();
  if (r.kotaAtlandi) {
    console.log(
      `kota koruması: ${r.aylikSayfa}/1000 sayfa, tur atlandı`
    );
  }
  console.log(
    JSON.stringify({
      ok: true,
      sayfa: r.sayfa,
      kart: r.kart,
      kayit: r.kayit,
      yeniFirma: r.yeniFirma,
      guncellenenFirma: r.guncellenenFirma,
      aiFallback: r.aiFallback,
      aiAtlandi: r.aiAtlandi,
      kotaAtlandi: r.kotaAtlandi,
      aylikSayfa: r.aylikSayfa,
    })
  );
  if (r.hatalar.length > 0) {
    console.error("[yuklegel] hatalar:", r.hatalar.join(" | "));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
