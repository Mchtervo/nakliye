/**
 * Günde 1 kez: dialog senkronu + Telegram araması → ADAY/AKTİF.
 * OpenAI yok. Daemon'dan ayrı GramJS oturumu (kısa bağlan-kop).
 */
import { Api, TelegramClient, utils } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { aramaSorgulariUret } from "@/lib/bolgeler";
import {
  adaylariDegerlendir,
  type BulunanGrup,
} from "@/lib/kaynaklar/telegramUye";

type Aday = BulunanGrup & { uye: boolean };

function sohbetiAdaya(
  sohbet: Api.TypeChat,
  dialogdan: boolean
): Aday | null {
  const uyeMi = (ayrilmis: boolean | undefined) =>
    dialogdan ? ayrilmis !== true : ayrilmis === false;

  if (sohbet instanceof Api.Channel) {
    const uye = uyeMi(sohbet.left);
    if (dialogdan && !uye) return null;
    return {
      chatId: utils.getPeerId(sohbet),
      baslik: sohbet.title || "",
      kullaniciAdi: sohbet.username || null,
      uyeSayisi: sohbet.participantsCount ?? null,
      uye,
    };
  }
  if (sohbet instanceof Api.Chat && dialogdan && uyeMi(sohbet.left)) {
    return {
      chatId: utils.getPeerId(sohbet),
      baslik: sohbet.title || "",
      kullaniciAdi: null,
      uyeSayisi: sohbet.participantsCount ?? null,
      uye: true,
    };
  }
  return null;
}

async function main() {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) {
    console.log("[cron-kesif] telegram üye tarama kapalı — atlandı.");
    return;
  }

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const oturum = process.env.TELEGRAM_SESSION || "";
  if (!apiId || !apiHash || !oturum) {
    throw new Error("TELEGRAM_API_ID/HASH/SESSION eksik");
  }

  const client = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 3,
    autoReconnect: false,
  });
  await client.connect();

  const adaylar: Aday[] = [];
  try {
    const dialogs = await client.getDialogs({ limit: 1000 });
    for (const d of dialogs) {
      if (!(d.isGroup || d.isChannel) || !d.entity) continue;
      const aday = sohbetiAdaya(d.entity as Api.TypeChat, true);
      if (aday?.baslik) adaylar.push(aday);
    }

    const sorgular = aramaSorgulariUret(
      tercih.bolgeler,
      tercih.koridorIller
    ).slice(0, 20);
    console.log(`[cron-kesif] dialog=${adaylar.length} sorgu=${sorgular.length}`);

    for (const sorgu of sorgular) {
      try {
        const sonuc = await client.invoke(
          new Api.contacts.Search({ q: sorgu, limit: 40 })
        );
        for (const sohbet of sonuc.chats) {
          const aday = sohbetiAdaya(sohbet, false);
          if (aday?.baslik) adaylar.push(aday);
        }
      } catch (e) {
        console.warn(
          "[cron-kesif] arama",
          sorgu,
          e instanceof Error ? e.message : e
        );
      }
    }
  } finally {
    await client.disconnect().catch(() => null);
  }

  const rapor = await adaylariDegerlendir(adaylar);
  console.log(JSON.stringify({ adayHavuz: adaylar.length, ...rapor }));

  // Keşif sonrası temizlik onayı (Telegram Evet/Hayır)
  try {
    const { cikisOnayiIste } = await import("@/lib/kaynaklar/grupTemizlik");
    const t = await cikisOnayiIste();
    console.log(JSON.stringify({ temizlik: t }));
  } catch (e) {
    console.warn("[cron-kesif] temizlik", e instanceof Error ? e.message : e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
