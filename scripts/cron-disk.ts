/**
 * Disk doluluk — %80+ ise Telegram uyarısı (saatte 1 kez cron).
 */
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { telegramGonder, htmlKacis } from "@/lib/bildirim/telegram";

const ESİK = Number(process.env.DISK_UYARI_YUZDE || 80);

function kokKullanim(): { yuzde: number; satir: string } {
  const out = execFileSync("df", ["-P", "/"], { encoding: "utf8" });
  const satir = out.trim().split("\n").at(-1) || "";
  const parca = satir.split(/\s+/);
  const yuzde = Number(String(parca[4] || "").replace("%", ""));
  return {
    yuzde: Number.isFinite(yuzde) ? yuzde : -1,
    satir: satir.trim(),
  };
}

async function main() {
  const { yuzde, satir } = kokKullanim();
  console.log(`[cron-disk] ${yuzde}% — ${satir}`);
  if (yuzde < 0) throw new Error("df parse edilemedi");
  if (yuzde < ESİK) return;

  const chatId = await ayarOku(AYAR_ANAHTARLARI.telegramChatId);
  const metin =
    `<b>Yük Avcısı — disk uyarısı</b>\n` +
    `Kök disk %${yuzde} (eşik %${ESİK})\n` +
    `<code>${htmlKacis(satir)}</code>`;

  if (!chatId) {
    console.warn("[cron-disk] telegram_chat_id yok");
    return;
  }
  const sonuc = await telegramGonder(chatId, metin);
  if (!sonuc.basarili) throw new Error(sonuc.hata || "telegram hata");
  console.log("[cron-disk] uyarı gönderildi");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
