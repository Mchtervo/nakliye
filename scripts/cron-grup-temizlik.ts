/**
 * Keşiften sonra: ölü/alakasız grup adaylarını Telegram'da onaylat.
 *   npm run ts -- scripts/cron-grup-temizlik.ts
 */
import { prisma } from "@/lib/prisma";
import {
  aiTercihleriOku,
  SAYAC_MIN_VERI_GUN,
  sayacBaslangicGaranti,
} from "@/lib/ayarlar";
import {
  aktifGrupOncelikGuncelle,
  cikisAdaylariniBul,
  cikisOnayiIste,
} from "@/lib/kaynaklar/grupTemizlik";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";

async function main() {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) {
    console.log("[grup-temizlik] üye tarama kapalı — atlandı.");
    return;
  }

  const skor = await aktifGrupOncelikGuncelle();
  console.log(`[grup-temizlik] oncelik guncelle: ${skor.guncellenen} grup`);

  const sayacGun = await sayacBaslangicGaranti();
  const bugun = bugunAnahtar();
  const veriGun = Math.max(
    0,
    Math.floor(
      (Date.parse(`${bugun}T12:00:00+03:00`) -
        Date.parse(`${sayacGun}T12:00:00+03:00`)) /
        (24 * 60 * 60 * 1000)
    )
  );
  const adaylar = await cikisAdaylariniBul();
  console.log(
    JSON.stringify({
      sayacBaslangic: sayacGun,
      veriGun,
      sayacHazir: veriGun >= SAYAC_MIN_VERI_GUN,
      adaySayisi: adaylar.length,
      adaylar: adaylar.slice(0, 10).map((a) => ({
        id: a.id,
        ad: a.ad,
        sebep: a.sebep,
        mesaj: a.mesajSayisi,
        ilan: a.ilanSayisi,
        isabet: a.isabetYuzde,
      })),
    })
  );

  const r = await cikisOnayiIste();
  console.log(
    JSON.stringify({
      ok: true,
      aday: r.aday,
      gonderildi: r.gonderildi,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
