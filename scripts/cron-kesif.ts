/**
 * Günde 1–2 kez: dialog senkronu + Telegram araması → ADAY/AKTİF.
 * OpenAI yok. Daemon'dan ayrı GramJS oturumu (kısa bağlan-kop).
 *
 * Sorgular dönüşümlü 20’lik dilim (telegram_sorgu_sira) —
 * her tur aynı ilk 20’yi tekrarlamaz.
 */
import { Api, TelegramClient, utils } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { prisma } from "@/lib/prisma";
import {
  AYAR_ANAHTARLARI,
  aiTercihleriOku,
  ayarOku,
  ayarYaz,
} from "@/lib/ayarlar";
import {
  aramaSorgulariUret,
  kesifSorguDilimi,
} from "@/lib/bolgeler";
import {
  adaylariDegerlendir,
  TELEGRAM_UYE,
  type BulunanGrup,
} from "@/lib/kaynaklar/telegramUye";

type Aday = BulunanGrup & { uye: boolean };

function sohbetiAdaya(
  sohbet: Api.TypeChat,
  dialogdan: boolean
): Aday | null {
  const uyeMi = (ayrilmis: boolean | undefined) =>
    dialogdan ? ayrilmis !== true : ayrilmis === false;

  // User / Bot asla ADAY olmaz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((sohbet as any)?.className === "User" || sohbet instanceof Api.User) {
    return null;
  }

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

function timeoutMu(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /TIMEOUT|TIMEOUT_EXTRACT|timed?\s*out/i.test(msg);
}

async function guvenliKop(client: TelegramClient): Promise<void> {
  try {
    await Promise.race([
      client.disconnect(),
      new Promise<void>((r) => setTimeout(r, 4000)),
    ]);
  } catch (e) {
    if (!timeoutMu(e)) {
      console.warn(
        "[cron-kesif] disconnect",
        e instanceof Error ? e.message : e
      );
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).destroy?.();
  } catch {
    /* yok say */
  }
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
  let sorgular: string[] = [];
  try {
    const dialogs = await client.getDialogs({ limit: 1000 });
    for (const d of dialogs) {
      if (!(d.isGroup || d.isChannel) || !d.entity) continue;
      const aday = sohbetiAdaya(d.entity as Api.TypeChat, true);
      if (aday?.baslik) adaylar.push(aday);
    }

    const tum = aramaSorgulariUret(tercih.bolgeler, tercih.koridorIller);
    const siraHam = Number(await ayarOku(AYAR_ANAHTARLARI.telegramSorguSira));
    const sira = Number.isFinite(siraHam) && siraHam >= 0 ? siraHam : 0;
    const dilim = kesifSorguDilimi(tum, sira);
    sorgular = dilim.sorgular;
    await ayarYaz(
      AYAR_ANAHTARLARI.telegramSorguSira,
      String(dilim.sonrakiSira)
    );
    await ayarYaz(
      AYAR_ANAHTARLARI.telegramKesifZaman,
      new Date().toISOString()
    );

    console.log(
      `[cron-kesif] dialog=${adaylar.length} sorgu=${sorgular.length} sira=${sira}→${dilim.sonrakiSira} havuz=${tum.length}`
    );
    if (sorgular.length > 0) {
      console.log(`[cron-kesif] sorgu örnek: ${sorgular.slice(0, 5).join(" · ")}`);
    }

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
        if (timeoutMu(e)) {
          console.warn("[cron-kesif] arama TIMEOUT", sorgu);
          continue;
        }
        console.warn(
          "[cron-kesif] arama",
          sorgu,
          e instanceof Error ? e.message : e
        );
      }
    }
  } finally {
    await guvenliKop(client);
  }

  const onceAktif = await prisma.ilanKaynagi.count({
    where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
  });

  const rapor = await adaylariDegerlendir(adaylar);
  console.log(JSON.stringify({ adayHavuz: adaylar.length, ...rapor }));

  const sonraAktif = await prisma.ilanKaynagi.count({
    where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
  });
  const katilan = rapor.hazirUyelik + rapor.terfi;
  const ozet =
    `Keşif: ${rapor.yeniAday} aday grup bulundu, ` +
    `${katilan}'sine katıldı, ${onceAktif}→${sonraAktif} grup.`;
  console.log(`[cron-kesif] ${ozet}`);

  try {
    const { telegramGonder, telegramKullanilabilir } = await import(
      "@/lib/bildirim/telegram"
    );
    if (
      tercih.telegramAcik &&
      tercih.telegramChatId &&
      telegramKullanilabilir()
    ) {
      await telegramGonder(tercih.telegramChatId, ozet);
    }
  } catch (e) {
    console.warn(
      "[cron-kesif] özet bildirim",
      e instanceof Error ? e.message : e
    );
  }

  try {
    const { cikisOnayiIste } = await import("@/lib/kaynaklar/grupTemizlik");
    const t = await cikisOnayiIste();
    console.log(JSON.stringify({ temizlik: t }));
  } catch (e) {
    if (timeoutMu(e)) {
      console.warn("[cron-kesif] temizlik TIMEOUT — yok sayıldı");
    } else {
      console.warn("[cron-kesif] temizlik", e instanceof Error ? e.message : e);
    }
  }
}

main()
  .catch((e) => {
    if (timeoutMu(e)) {
      console.warn(
        "[cron-kesif] TIMEOUT (bağlantı kapanışı) — akış tamamlandı sayılır"
      );
      return;
    }
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
