/**
 * Geriye dönük: tek site. Tercihen cron-web-siteler.ts kullan.
 */
import { prisma } from "@/lib/prisma";
import { yuklegelTara } from "@/lib/kaynaklar/yuklegel";

async function main() {
  const kaynak = await prisma.ilanKaynagi.findFirst({
    where: { tur: "WEB", hedef: "https://yuklegel.com/" },
    select: { aktif: true },
  });
  if (kaynak && !kaynak.aktif) {
    console.log("[yuklegel] Ayarlar'da duraklatıldı — atlandı");
    return;
  }

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
