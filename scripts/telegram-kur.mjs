/**
 * Telegram webhook'unu kurar.
 *
 * Kullanım:
 *   npm run telegram:kur -- https://siteadresin.netlify.app
 *
 * Adres verilmezse .env içindeki SITE_URL kullanılır.
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const gizli = process.env.TELEGRAM_WEBHOOK_SECRET;
const adres = (process.argv[2] || process.env.SITE_URL || "").replace(/\/$/, "");

function hata(mesaj) {
  console.error(`\n  HATA: ${mesaj}\n`);
  process.exit(1);
}

if (!token) hata("TELEGRAM_BOT_TOKEN tanımlı değil (.env dosyasına ekle).");
if (!gizli) hata("TELEGRAM_WEBHOOK_SECRET tanımlı değil (.env dosyasına ekle).");
if (!adres) hata("Site adresi ver: npm run telegram:kur -- https://siteadresin");
if (!adres.startsWith("https://")) {
  hata("Telegram sadece https adresleri kabul eder.");
}

const webhookUrl = `${adres}/api/telegram/webhook`;

const cevap = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: gizli,
    allowed_updates: ["message", "channel_post"],
    drop_pending_updates: true,
  }),
});

const veri = await cevap.json();

if (!veri.ok) hata(veri.description || "setWebhook başarısız.");

const bilgi = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  .then((c) => c.json())
  .catch(() => null);

console.log("\n  Webhook kuruldu.");
console.log(`  Adres : ${webhookUrl}`);
if (bilgi?.ok) console.log(`  Bot   : @${bilgi.result.username}`);
console.log("\n  Sırada:");
console.log("  1) BotFather > /setprivacy > botunu seç > Disable");
console.log("  2) Botu yük gruplarına ekle (privacy'yi sonra kapattıysan çıkar-ekle)");
console.log("  3) Bota özelden /baglan yaz (bildirimler oraya gelsin)\n");
