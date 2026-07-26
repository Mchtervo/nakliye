/**
 * IL_YOK ölçümü — OpenAI yok. Telegram + illeriBul.
 */
import { PrismaClient } from "@prisma/client";
import { TelegramClient, utils } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { illeriBul, takmaAdSayisi } from "../lib/iller.ts";

const p = new PrismaClient();
const BUGUN_IL_YOK = 144;

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const oturum = process.env.TELEGRAM_SESSION || "";

  if (!apiId || !apiHash || !oturum) {
    console.log(JSON.stringify({ hata: "Telegram oturumu yok" }));
    return;
  }

  const istemci = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 1,
    autoReconnect: false,
  });
  await istemci.connect();

  const aktif = await p.ilanKaynagi.findMany({
    where: { tur: "TELEGRAM_UYE", aktif: true, durum: "AKTIF" },
    take: 15,
    select: { id: true, ad: true, hedef: true, kullaniciAdi: true },
  });

  const dialogs = await istemci.getDialogs({ limit: 500 });
  const harita = new Map<string, unknown>();
  for (const d of dialogs) {
    if (!(d.isGroup || d.isChannel) || !d.entity) continue;
    try {
      harita.set(utils.getPeerId(d.entity), d.entity);
    } catch {
      /* */
    }
  }

  let toplam = 0;
  let ilYokSadeceIl = 0;
  let ilYokTam = 0;
  let kurtulan = 0;
  const ornekKurtulan: { grup: string; iller: string[]; metin: string }[] = [];

  for (const g of aktif) {
    let entity = harita.get(String(g.hedef)) as never;
    if (!entity && g.kullaniciAdi) {
      try {
        entity = (await istemci.getEntity(g.kullaniciAdi)) as never;
      } catch {
        entity = null as never;
      }
    }
    if (!entity) continue;

    try {
      const msgs = await istemci.getMessages(entity, { limit: 40 });
      for (const m of msgs) {
        if (typeof m.message !== "string" || m.message.trim().length < 15) {
          continue;
        }
        toplam += 1;
        const a = illeriBul(m.message, { sadeceIlAdi: true });
        const b = illeriBul(m.message);
        if (a.length === 0) ilYokSadeceIl += 1;
        if (b.length === 0) ilYokTam += 1;
        if (a.length === 0 && b.length > 0) {
          kurtulan += 1;
          if (ornekKurtulan.length < 10) {
            ornekKurtulan.push({
              grup: g.ad,
              iller: b,
              metin: m.message.slice(0, 140).replace(/\s+/g, " "),
            });
          }
        }
      }
    } catch (e) {
      console.warn("okuma", g.ad, e instanceof Error ? e.message : e);
    }
  }

  await istemci.disconnect().catch(() => null);

  const oran = ilYokSadeceIl > 0 ? kurtulan / ilYokSadeceIl : 0;

  console.log(
    JSON.stringify(
      {
        takmaAdSayisi: takmaAdSayisi(),
        orneklenenMesaj: toplam,
        aktifGrupOrnek: aktif.length,
        /** İl adı yok sayılırken (ilçe kapalı) */
        ilYokSadeceIlAdi: ilYokSadeceIl,
        /** İlçe tablosu açıkken hâlâ IL_YOK */
        ilYokIlceTablosuyla: ilYokTam,
        /** İlçe tablosunun kurtardığı */
        kurtulanIlceTablosuyla: kurtulan,
        kurtarmaOraniYuzde: Number((oran * 100).toFixed(1)),
        /** Bugünkü 144 IL_YOK × örnek oran */
        bugun144TahminiKurtulan: Math.round(BUGUN_IL_YOK * oran),
        bugun144TahminiKalan: Math.round(BUGUN_IL_YOK * (1 - oran)),
        ornekKurtulan,
        not: "144 mesaj DB'de yok; oran Telegram örneklemesinden × 144.",
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
