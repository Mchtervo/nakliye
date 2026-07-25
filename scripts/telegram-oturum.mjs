/**
 * Kendi Telegram hesabınla bir kerelik giriş yapar ve oturum anahtarı üretir.
 * Bu anahtar sayesinde uygulama, üyesi olduğun yük gruplarını okuyabilir.
 *
 * Kullanım:
 *   npm run telegram:oturum
 *
 * Gerekli .env değerleri: TELEGRAM_API_ID, TELEGRAM_API_HASH
 * (my.telegram.org > API development tools sayfasından alınır)
 */

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import tg from "telegram";
import oturumlar from "telegram/sessions/index.js";

const { TelegramClient } = tg;
const { StringSession } = oturumlar;

function hata(mesaj) {
  console.error(`\n  HATA: ${mesaj}\n`);
  process.exit(1);
}

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!Number.isInteger(apiId) || apiId <= 0) {
  hata("TELEGRAM_API_ID tanımlı değil (.env dosyasına ekle).");
}
if (!apiHash) hata("TELEGRAM_API_HASH tanımlı değil (.env dosyasına ekle).");

const soru = readline.createInterface({ input: stdin, output: stdout });

console.log("\n  Telegram hesabına giriş yapılıyor.");
console.log("  Kod, Telegram uygulamana gelecek.\n");

const istemci = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 3,
});

try {
  await istemci.start({
    phoneNumber: async () =>
      (await soru.question("  Telefon (+905xxxxxxxxx): ")).trim(),
    phoneCode: async () =>
      (await soru.question("  Telegram'a gelen kod: ")).trim(),
    password: async () =>
      (await soru.question("  İki adımlı doğrulama şifresi (yoksa boş geç): ")).trim(),
    onError: (e) => console.error("  Telegram:", e?.message || e),
  });

  const ben = await istemci.getMe();
  const anahtar = istemci.session.save();

  console.log(`\n  Giriş başarılı: ${ben.firstName || ""} (@${ben.username || "-"})`);
  console.log("\n  Aşağıdaki satırı .env dosyana ekle ve Netlify'a da gir:\n");
  console.log(`TELEGRAM_SESSION=${anahtar}\n`);
  console.log("  Bu anahtar hesabına tam erişim verir; kimseyle paylaşma.\n");
} catch (e) {
  hata(e?.message || "Giriş yapılamadı.");
} finally {
  soru.close();
  await istemci.disconnect().catch(() => null);
  await istemci.destroy().catch(() => null);
  process.exit(0);
}
