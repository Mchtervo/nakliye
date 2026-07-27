/**
 * Koridor filtresini uygula:
 * 1) ai_koridor_iller yoksa varsayılan 8 ili yazar
 * 2) Koridor dışı YukIlani siler
 * 3) Son 7 gün ham mesajları yeniden kuyruğa alır
 *
 *   npm run ai:koridor-uygula
 */
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, aiTercihleriOku, ayarYaz } from "@/lib/ayarlar";
import {
  koridorIlKumesi,
  VARSAYILAN_KORIDOR_ILLER,
} from "@/lib/koridor";

async function main() {
  const mevcut = await prisma.ayar.findUnique({
    where: { anahtar: AYAR_ANAHTARLARI.aiKoridorIller },
  });
  if (!mevcut?.deger?.trim()) {
    await ayarYaz(
      AYAR_ANAHTARLARI.aiKoridorIller,
      VARSAYILAN_KORIDOR_ILLER.join(",")
    );
    console.log(
      `[koridor] Varsayılan yazıldı: ${VARSAYILAN_KORIDOR_ILLER.join(", ")}`
    );
  } else {
    console.log(`[koridor] Mevcut ayar: ${mevcut.deger}`);
  }

  const tercih = await aiTercihleriOku();
  const iller = koridorIlKumesi(tercih.koridorIller);
  console.log(`[koridor] Aktif liste (${iller.length}): ${iller.join(", ")}`);

  const oncekiToplam = await prisma.yukIlani.count();
  const koridorIci = await prisma.yukIlani.count({
    where: {
      cikisIl: { in: iller },
      varisIl: { in: iller },
    },
  });
  const silinecek = oncekiToplam - koridorIci;

  if (silinecek > 0) {
    const silinen = await prisma.yukIlani.deleteMany({
      where: {
        NOT: {
          AND: [{ cikisIl: { in: iller } }, { varisIl: { in: iller } }],
        },
      },
    });
    console.log(
      `[koridor] Koridor dışı silindi: ${silinen.count} (kalan ${koridorIci})`
    );
  } else {
    console.log(`[koridor] Silinecek yok — ${koridorIci} ilan zaten koridorda`);
  }

  const yediGun = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const yeniden = await prisma.hamMesaj.updateMany({
    where: { createdAt: { gte: yediGun } },
    data: { islendi: false, denemeSayisi: 0, hata: null },
  });
  const bekleyen = await prisma.hamMesaj.count({ where: { islendi: false } });

  console.log(
    `[koridor] Ham yeniden kuyruk: ${yeniden.count} · bekleyen toplam: ${bekleyen}`
  );
  console.log(
    `[koridor] ÖZET — ilan kalan: ${await prisma.yukIlani.count()} · ham bekleyen: ${bekleyen}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
