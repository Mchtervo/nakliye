/**
 * Cron hatasında Telegram bot bildirimi.
 * Kullanım: npm run ts -- scripts/cron-uyari.ts "mesaj"
 */
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { telegramGonder, htmlKacis } from "@/lib/bildirim/telegram";
import { prisma } from "@/lib/prisma";

async function main() {
  const metin = process.argv.slice(2).join(" ").trim() || "Cron hatası";
  const chatId = await ayarOku(AYAR_ANAHTARLARI.telegramChatId);
  if (!chatId) {
    console.error("[cron-uyari] telegram_chat_id yok —", metin);
    process.exit(0);
  }
  const sonuc = await telegramGonder(
    chatId,
    `<b>Yük Avcısı cron</b>\n${htmlKacis(metin.slice(0, 800))}`
  );
  if (!sonuc.basarili) {
    console.error("[cron-uyari]", sonuc.hata);
    process.exit(1);
  }
  console.log("[cron-uyari] gönderildi");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
