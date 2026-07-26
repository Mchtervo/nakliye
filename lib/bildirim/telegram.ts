const API_KOK = "https://api.telegram.org";

export function telegramKullanilabilir(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function apiUrl(metot: string): string {
  return `${API_KOK}/bot${process.env.TELEGRAM_BOT_TOKEN}/${metot}`;
}

/** HTML parse_mode için kaçış. */
export function htmlKacis(metin: string): string {
  return metin
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export type TelegramSonuc = { basarili: boolean; hata: string | null };

/** URL veya callback_data inline buton. */
export type InlineButon =
  | { metin: string; url: string; callback?: never }
  | { metin: string; callback: string; url?: never };

function inlineSatir(butonlar: InlineButon[]) {
  return butonlar.map((b) => {
    if ("url" in b && b.url) return { text: b.metin, url: b.url };
    return { text: b.metin, callback_data: (b.callback || "").slice(0, 64) };
  });
}

export async function telegramGonder(
  chatId: string,
  metin: string,
  butonlar?: InlineButon[]
): Promise<TelegramSonuc> {
  if (!telegramKullanilabilir()) {
    return { basarili: false, hata: "TELEGRAM_BOT_TOKEN tanımlı değil." };
  }

  const govde: Record<string, unknown> = {
    chat_id: chatId,
    text: metin,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (butonlar?.length) {
    // Telegram satırda ~3 buton rahat; WhatsApp/Takip/Elendi tek satır.
    govde.reply_markup = {
      inline_keyboard: [inlineSatir(butonlar)],
    };
  }

  try {
    const cevap = await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (cevap.ok) return { basarili: true, hata: null };

    const detay = await cevap.text().catch(() => "");
    return {
      basarili: false,
      hata: `Telegram ${cevap.status}: ${detay.slice(0, 200)}`,
    };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? hata.message : "Telegram bağlantı hatası",
    };
  }
}

export async function telegramCallbackCevapla(
  callbackQueryId: string,
  metin?: string
): Promise<TelegramSonuc> {
  if (!telegramKullanilabilir()) {
    return { basarili: false, hata: "TELEGRAM_BOT_TOKEN tanımlı değil." };
  }

  try {
    const cevap = await fetch(apiUrl("answerCallbackQuery"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: metin?.slice(0, 200),
        show_alert: false,
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (cevap.ok) return { basarili: true, hata: null };
    const detay = await cevap.text().catch(() => "");
    return {
      basarili: false,
      hata: `Telegram ${cevap.status}: ${detay.slice(0, 200)}`,
    };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? hata.message : "Telegram bağlantı hatası",
    };
  }
}

export async function webhookKur(
  webhookUrl: string,
  gizliAnahtar: string
): Promise<TelegramSonuc> {
  if (!telegramKullanilabilir()) {
    return { basarili: false, hata: "TELEGRAM_BOT_TOKEN tanımlı değil." };
  }

  try {
    const cevap = await fetch(apiUrl("setWebhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: gizliAnahtar,
        allowed_updates: ["message", "channel_post", "callback_query"],
        drop_pending_updates: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const veri = (await cevap.json()) as { ok?: boolean; description?: string };
    if (veri.ok) return { basarili: true, hata: null };
    return { basarili: false, hata: veri.description || "Bilinmeyen hata" };
  } catch (hata) {
    return {
      basarili: false,
      hata: hata instanceof Error ? hata.message : "Bağlantı hatası",
    };
  }
}
