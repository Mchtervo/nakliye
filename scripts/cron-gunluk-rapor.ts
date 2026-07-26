/**
 * 20:00 TR — OpenAI'siz operasyon özeti → Telegram.
 */
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { telegramGonder, htmlKacis } from "@/lib/bildirim/telegram";
import {
  bugunAnahtar,
  elemeSayaclariOku,
} from "@/lib/kaynaklar/elemeSayac";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

async function main() {
  const gun = bugunAnahtar();
  const bas = new Date(`${gun}T00:00:00+03:00`);

  const [
    eleme,
    hamBugun,
    hamBekleyen,
    ilanBugun,
    aktifGrup,
    adayGrup,
    katilimHam,
  ] = await Promise.all([
    elemeSayaclariOku(gun),
    prisma.hamMesaj.count({ where: { createdAt: { gte: bas } } }),
    prisma.hamMesaj.count({ where: { islendi: false } }),
    prisma.yukIlani.count({ where: { createdAt: { gte: bas } } }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
    }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, durum: "ADAY" },
    }),
    ayarOku(AYAR_ANAHTARLARI.telegramKatilimGunluk),
  ]);

  const elemeSatir =
    Object.keys(eleme).length === 0
      ? "eleme yok"
      : Object.entries(eleme)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ");

  const metin = [
    `<b>Yük Avcısı — günlük rapor</b> (${htmlKacis(gun)})`,
    `Ham mesaj bugün: ${hamBugun}`,
    `Kuyruk bekleyen: ${hamBekleyen}`,
    `İlan bugün: ${ilanBugun}`,
    `Grup AKTİF / ADAY: ${aktifGrup} / ${adayGrup}`,
    `Katılım sayaç: ${htmlKacis(katilimHam || "0")}`,
    `Ön filtre: ${htmlKacis(elemeSatir)}`,
    `AI_KAPALI: ${process.env.AI_KAPALI || "?"}`,
  ].join("\n");

  const chatId = await ayarOku(AYAR_ANAHTARLARI.telegramChatId);
  if (!chatId) {
    console.log(metin.replace(/<[^>]+>/g, ""));
    console.warn("[cron-gunluk-rapor] telegram_chat_id yok — sadece log");
    return;
  }

  const sonuc = await telegramGonder(chatId, metin);
  if (!sonuc.basarili) throw new Error(sonuc.hata || "telegram hata");
  console.log("[cron-gunluk-rapor] gönderildi");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
