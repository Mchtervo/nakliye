/**
 * Yarım saatte bir: okuyucu kopuk mu + (09:00 sonrası günde bir) ödeme hatırlatma.
 *   npm run ts -- scripts/cron-hatirlatma.ts
 */
import { prisma } from "@/lib/prisma";
import { anaPrisma } from "@/lib/prismaAna";
import { uyeAdinaCalistir } from "@/lib/baglam";
import {
  bakimHatirlat,
  belgeHatirlat,
  kartHatirlat,
  krediHatirlat,
  odemeHatirlat,
  okuyucuHatirlat,
  yakitHatirlat,
  yolculukKontrol,
  yolculukSor,
} from "@/lib/bildirim/hatirlatma";
import { ikonHatirlat } from "@/lib/bildirim/ikonGuncelleme";
import { seferHatirlat } from "@/lib/bildirim/sefer";

async function main() {
  const okuyucu = await okuyucuHatirlat();
  const odeme = await odemeHatirlat();
  const ikon = await ikonHatirlat();
  const yolculuk = (await yolculukSor()) || (await yolculukKontrol());
  const bakim = await bakimHatirlat();
  const belge = await belgeHatirlat();
  const yakit = await yakitHatirlat();
  const kart = await kartHatirlat();
  const kredi = await krediHatirlat();
  const sefer = await seferHatirlat().catch((e) => {
    console.error("[cron-hatirlatma] sefer", e instanceof Error ? e.message : e);
    return false;
  });
  // Üyeler: kendi defterlerinde, kendi cihaz / bildirim kutularına (Telegram yalnız yöneticide)
  const uyeler = await anaPrisma.uye.findMany({ where: { aktif: true, kurulumBitti: { not: null } }, select: { id: true } });
  let uyeBildirim = 0;
  for (const u of uyeler) {
    try {
      uyeBildirim += await uyeAdinaCalistir(u.id, async () => {
        const o = await odemeHatirlat();
        return o.adet + (await bakimHatirlat() ? 1 : 0) + (await belgeHatirlat()) + (await kartHatirlat()) + (await krediHatirlat()) + ((await yakitHatirlat()) ? 1 : 0) + ((await seferHatirlat()) ? 1 : 0);
      });
    } catch (e) {
      console.error(`[cron-hatirlatma] üye ${u.id}`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`[cron-hatirlatma] üyeler=${uyeler.length} üye-bildirim=${uyeBildirim}`);
  console.log(
    `[cron-hatirlatma] okuyucu=${okuyucu} odeme=${odeme.adet}${odeme.atlandi ? ` (${odeme.atlandi})` : ""} ikon=${ikon} yolculuk=${yolculuk} bakim=${bakim} belge=${belge} yakit=${yakit} kart=${kart} kredi=${kredi} sefer=${sefer}`
  );
}

main()
  .catch((e) => {
    console.error("[cron-hatirlatma]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
