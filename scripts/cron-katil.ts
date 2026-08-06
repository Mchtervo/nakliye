/**
 * ADAY gruba otomatik katılım — günde max 8, arası ≥30 dk.
 * Hasat linkleri (oncelik yüksek) önce. FloodWait → 24s kilit.
 * Katılmadan önce son 20 mesajda ilan sinyali ≥%20 şart.
 * OpenAI yok.
 */
import { Api, TelegramClient, errors, utils } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { prisma } from "@/lib/prisma";
import {
  AYAR_ANAHTARLARI,
  aiTercihleriOku,
  ayarOku,
  ayarYaz,
} from "@/lib/ayarlar";
import {
  katilimRedSebebi,
  koridorBaslikOnceligi,
  yukBasligiMi,
} from "@/lib/bolgeler";
import { bugunAnahtar } from "@/lib/kaynaklar/elemeSayac";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import {
  KATILIM_ARA_MS,
  KATILIM_GUNLUK_LIMIT,
  katilimMinUyeOku,
} from "@/lib/kaynaklar/katilimLimit";
import { ilanSinyalOrani } from "@/lib/kaynaklar/onFiltre";

const GUNLUK_LIMIT = KATILIM_GUNLUK_LIMIT;
const ARA_MS = KATILIM_ARA_MS;
const ICERIK_MIN_ORAN = 0.2;
const ICERIK_MIN_MESAJ = 10;

function gunlukOku(ham: string | null): { gun: string; adet: number } {
  const bugun = bugunAnahtar();
  if (!ham) return { gun: bugun, adet: 0 };
  const [gun, adetHam] = ham.split(":");
  if (gun !== bugun) return { gun: bugun, adet: 0 };
  const adet = Number(adetHam);
  return { gun: bugun, adet: Number.isFinite(adet) ? adet : 0 };
}

type KatilimAday = {
  id: number;
  ad: string;
  kullaniciAdi: string | null;
  hedef: string;
  /** inv:hash → ImportChatInvite */
  davetHash: string | null;
};

/** Çöp ADAY'ları PASİF yap; koridor başlıklıları + hasat/davet öne al. */
async function adaySec(haric: Set<number>): Promise<KatilimAday | null> {
  const minUye = await katilimMinUyeOku();
  const adaylar = await prisma.ilanKaynagi.findMany({
    where: {
      tur: TELEGRAM_UYE,
      durum: "ADAY",
      aktif: true,
      id: haric.size > 0 ? { notIn: [...haric] } : undefined,
      OR: [
        {
          kullaniciAdi: { not: null },
          OR: [{ uyeSayisi: null }, { uyeSayisi: { gte: minUye } }],
        },
        { hedef: { startsWith: "inv:" } },
      ],
    },
    orderBy: [{ oncelik: "desc" }, { uyeSayisi: "desc" }, { id: "asc" }],
    take: 50,
    select: {
      id: true,
      ad: true,
      kullaniciAdi: true,
      hedef: true,
      oncelik: true,
      uyeSayisi: true,
      hasatKaynak: true,
    },
  });

  const uygun: (KatilimAday & { skor: number })[] = [];

  for (const a of adaylar) {
    const davet =
      a.hedef.startsWith("inv:") && a.hedef.length > 4
        ? a.hedef.slice(4)
        : null;

    // Davet: başlık henüz yok — katılınca kontrol
    if (!davet) {
      const red = katilimRedSebebi(a.ad);
      if (red) {
        await prisma.ilanKaynagi.update({
          where: { id: a.id },
          data: {
            aktif: false,
            durum: "PASIF",
            sonHata: `Katılım RED: ${red}`.slice(0, 300),
          },
        });
        console.log(`[cron-katil] RED → PASIF #${a.id} (${red}): ${a.ad}`);
        continue;
      }
      if (!yukBasligiMi(a.ad)) {
        await prisma.ilanKaynagi.update({
          where: { id: a.id },
          data: {
            aktif: false,
            durum: "PASIF",
            sonHata: "Otomatik katılım: başlık yük grubu değil → PASIF",
          },
        });
        console.log(`[cron-katil] başlık elendi → PASIF #${a.id}: ${a.ad}`);
        continue;
      }
    }

    const koridor = koridorBaslikOnceligi(a.ad);
    const hasatBonus = a.hasatKaynak ? 25 : 0;
    const davetBonus = davet ? 20 : 0;
    const skor =
      (a.oncelik ?? 0) +
      koridor * 50 +
      (koridor > 0 ? 100 : 0) +
      hasatBonus +
      davetBonus +
      Math.min(a.uyeSayisi ?? 0, 5000) / 5000;
    if (!davet && koridor > 0 && (a.oncelik ?? 0) < 20 + koridor) {
      await prisma.ilanKaynagi
        .update({
          where: { id: a.id },
          data: { oncelik: 20 + koridor },
        })
        .catch(() => null);
    }
    uygun.push({
      id: a.id,
      ad: a.ad,
      kullaniciAdi: a.kullaniciAdi,
      hedef: a.hedef,
      davetHash: davet,
      skor,
    });
  }

  uygun.sort((x, y) => y.skor - x.skor);
  return uygun[0] ?? null;
}

async function aktifYap(
  adayId: number,
  chatId: string,
  baslik: string
): Promise<void> {
  const cakisan = await prisma.ilanKaynagi.findFirst({
    where: {
      tur: TELEGRAM_UYE,
      hedef: chatId,
      id: { not: adayId },
    },
    select: { id: true },
  });
  if (cakisan) {
    await prisma.ilanKaynagi.update({
      where: { id: adayId },
      data: {
        aktif: false,
        durum: "PASIF",
        sonHata: `Katıldı ama chatId #${cakisan.id} ile çakıştı`,
      },
    });
    await prisma.ilanKaynagi.update({
      where: { id: cakisan.id },
      data: { durum: "AKTIF", aktif: true, sonHata: null },
    });
    return;
  }
  await prisma.ilanKaynagi.update({
    where: { id: adayId },
    data: {
      hedef: chatId,
      ad: baslik.slice(0, 120),
      durum: "AKTIF",
      aktif: true,
      sonHata: null,
      sonTarama: new Date(),
    },
  });
}

/** Son 20 mesajda ilan sinyali oranı. Düşükse PASIF + false. */
async function icerikUygunMu(
  client: TelegramClient,
  aday: { id: number; ad: string; kullaniciAdi: string }
): Promise<boolean> {
  try {
    const entity = await client.getEntity(aday.kullaniciAdi.replace(/^@/, ""));
    const mesajlar = await client.getMessages(entity, { limit: 20 });
    const metinler = mesajlar
      .filter((m) => typeof m.message === "string" && m.message.trim())
      .map((m) => m.message as string);
    if (metinler.length < ICERIK_MIN_MESAJ) {
      console.log(
        `[cron-katil] içerik seyrek #${aday.id} (${metinler.length} mesaj) — geç`
      );
      return true;
    }
    const oran = ilanSinyalOrani(metinler);
    const yuzde = Math.round(oran * 100);
    if (oran < ICERIK_MIN_ORAN) {
      await prisma.ilanKaynagi.update({
        where: { id: aday.id },
        data: {
          aktif: false,
          durum: "PASIF",
          sonHata:
            `Katılım RED: içerik sinyal %${yuzde} < %${ICERIK_MIN_ORAN * 100} (son ${metinler.length} mesaj)`.slice(
              0,
              300
            ),
        },
      });
      console.log(
        `[cron-katil] içerik elendi → PASIF #${aday.id} ${aday.ad}: sinyal %${yuzde}`
      );
      return false;
    }
    console.log(
      `[cron-katil] içerik OK #${aday.id} ${aday.ad}: sinyal %${yuzde}`
    );
    return true;
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    console.warn(`[cron-katil] içerik okunamadı #${aday.id}: ${mesaj}`);
    await prisma.ilanKaynagi.update({
      where: { id: aday.id },
      data: {
        sonHata: `İçerik kontrolü başarısız: ${mesaj}`.slice(0, 300),
      },
    });
    return false;
  }
}

async function main() {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) {
    console.log("[cron-katil] üye tarama kapalı — atlandı.");
    return;
  }
  const oto = await ayarOku(AYAR_ANAHTARLARI.telegramOtoKatilim);
  if (oto === "0") {
    console.log("[cron-katil] otomatik katılım kapalı — atlandı.");
    return;
  }

  const flood = Date.parse(
    (await ayarOku(AYAR_ANAHTARLARI.telegramFloodBitis)) || ""
  );
  if (Number.isFinite(flood) && Date.now() < flood) {
    console.log(
      `[cron-katil] FloodWait kilitli → ${new Date(flood).toISOString()}`
    );
    return;
  }

  const sayac = gunlukOku(await ayarOku(AYAR_ANAHTARLARI.telegramKatilimGunluk));
  if (sayac.adet >= GUNLUK_LIMIT) {
    console.log(`[cron-katil] günlük limit ${sayac.adet}/${GUNLUK_LIMIT}`);
    return;
  }

  const son = Date.parse(
    (await ayarOku(AYAR_ANAHTARLARI.telegramSonKatilim)) || ""
  );
  if (Number.isFinite(son) && Date.now() - son < ARA_MS) {
    const kalan = Math.ceil((ARA_MS - (Date.now() - son)) / 60000);
    console.log(`[cron-katil] ara: ${kalan} dk daha bekle`);
    return;
  }

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const oturum = process.env.TELEGRAM_SESSION || "";
  if (!apiId || !apiHash || !oturum) {
    throw new Error("TELEGRAM_API_ID/HASH/SESSION eksik");
  }

  // Eski hasat davetleri pasif kaydedilmişti → katılım kuyruğuna al
  await prisma.ilanKaynagi.updateMany({
    where: {
      tur: TELEGRAM_UYE,
      durum: "ADAY",
      hedef: { startsWith: "inv:" },
      aktif: false,
    },
    data: { aktif: true, oncelik: 16 },
  });

  const client = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 3,
    autoReconnect: false,
  });
  await client.connect();

  const haric = new Set<number>();
  let aday: KatilimAday | null = null;
  try {
    for (let i = 0; i < 8; i++) {
      aday = await adaySec(haric);
      if (!aday) {
        console.log("[cron-katil] uygun ADAY yok");
        return;
      }
      haric.add(aday.id);
      // Davet: içerik kontrolü katılım sonrası; username: önce sinyal
      if (aday.davetHash) break;
      if (!aday.kullaniciAdi) {
        aday = null;
        continue;
      }
      const ok = await icerikUygunMu(client, {
        id: aday.id,
        ad: aday.ad,
        kullaniciAdi: aday.kullaniciAdi,
      });
      if (ok) break;
      aday = null;
    }
    if (!aday || (!aday.kullaniciAdi && !aday.davetHash)) {
      console.log("[cron-katil] içerik uygun ADAY kalmadı");
      return;
    }

    try {
      let chatId = "";
      let baslik = aday.ad;

      if (aday.davetHash) {
        console.log(`[cron-katil] davet deneme inv:${aday.davetHash.slice(0, 8)}…`);
        const updates = await client.invoke(
          new Api.messages.ImportChatInvite({ hash: aday.davetHash })
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chats = (updates as any)?.chats as Api.TypeChat[] | undefined;
        const ch = chats?.find(
          (c) => c instanceof Api.Channel || c instanceof Api.Chat
        );
        if (!ch) {
          await prisma.ilanKaynagi.update({
            where: { id: aday.id },
            data: {
              sonHata: "Davet OK ama chat çözülemedi",
              aktif: false,
              durum: "PASIF",
            },
          });
          return;
        }
        chatId = String(utils.getPeerId(ch));
        baslik =
          ch instanceof Api.Channel || ch instanceof Api.Chat
            ? (ch.title || aday.ad).slice(0, 120)
            : aday.ad;
        const red = katilimRedSebebi(baslik);
        if (red || !yukBasligiMi(baslik)) {
          try {
            if (ch instanceof Api.Channel) {
              await client.invoke(
                new Api.channels.LeaveChannel({
                  channel: await client.getInputEntity(ch),
                })
              );
            }
          } catch {
            /* leave best-effort */
          }
          await prisma.ilanKaynagi.update({
            where: { id: aday.id },
            data: {
              aktif: false,
              durum: "PASIF",
              ad: baslik,
              hedef: chatId,
              sonHata: `Davet sonrası RED: ${red || "yük başlığı değil"}`.slice(
                0,
                300
              ),
            },
          });
          console.log(`[cron-katil] davet RED → çıkıldı: ${baslik}`);
          return;
        }
      } else {
        const kullanici = aday.kullaniciAdi!.replace(/^@/, "");
        console.log(`[cron-katil] deneme @${kullanici} (${aday.ad})`);
        const entity = await client.getEntity(kullanici);
        const channel = await client.getInputEntity(entity);
        await client.invoke(new Api.channels.JoinChannel({ channel }));
        chatId = String(utils.getPeerId(entity));
        baslik =
          entity instanceof Api.Channel && entity.title
            ? entity.title
            : aday.ad;
      }

      await aktifYap(aday.id, chatId, baslik);
      await ayarYaz(
        AYAR_ANAHTARLARI.telegramSonKatilim,
        new Date().toISOString()
      );
      await ayarYaz(
        AYAR_ANAHTARLARI.telegramKatilimGunluk,
        `${sayac.gun}:${sayac.adet + 1}`
      );
      console.log(
        JSON.stringify({
          ok: true,
          grup: baslik,
          davet: Boolean(aday.davetHash),
          bugun: `${sayac.adet + 1}/${GUNLUK_LIMIT}`,
        })
      );
    } catch (e) {
      const mesaj = e instanceof Error ? e.message : String(e);

      if (e instanceof errors.FloodWaitError) {
        const kilit = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await ayarYaz(AYAR_ANAHTARLARI.telegramFloodBitis, kilit.toISOString());
        console.error(
          `[cron-katil] FloodWait ${e.seconds}s → 24s kilit ${kilit.toISOString()}`
        );
        throw e;
      }

      if (/INVITE_REQUEST_SENT|InviteRequestSent/i.test(mesaj)) {
        await prisma.ilanKaynagi.update({
          where: { id: aday.id },
          data: {
            sonHata: "Katılım isteği gönderildi (onay bekliyor)",
            sonTarama: new Date(),
          },
        });
        await ayarYaz(
          AYAR_ANAHTARLARI.telegramSonKatilim,
          new Date().toISOString()
        );
        await ayarYaz(
          AYAR_ANAHTARLARI.telegramKatilimGunluk,
          `${sayac.gun}:${sayac.adet + 1}`
        );
        console.log(
          JSON.stringify({
            ok: true,
            davetIstegi: true,
            grup: aday.ad,
            bugun: `${sayac.adet + 1}/${GUNLUK_LIMIT}`,
          })
        );
        return;
      }

      if (/USER_ALREADY_PARTICIPANT|already a participant/i.test(mesaj)) {
        if (aday.kullaniciAdi) {
          try {
            const entity = await client.getEntity(
              aday.kullaniciAdi.replace(/^@/, "")
            );
            const chatId = String(utils.getPeerId(entity));
            const baslik =
              entity instanceof Api.Channel && entity.title
                ? entity.title
                : aday.ad;
            await aktifYap(aday.id, chatId, baslik);
          } catch {
            await prisma.ilanKaynagi.update({
              where: { id: aday.id },
              data: { durum: "AKTIF", aktif: true, sonHata: null },
            });
          }
        }
        console.log("[cron-katil] zaten üye → AKTİF", aday.ad);
        return;
      }

      if (/INVITE_HASH_EXPIRED|INVITE_HASH_INVALID/i.test(mesaj)) {
        await prisma.ilanKaynagi.update({
          where: { id: aday.id },
          data: {
            aktif: false,
            durum: "PASIF",
            sonHata: mesaj.slice(0, 300),
          },
        });
        console.log("[cron-katil] davet geçersiz → PASIF", aday.id);
        return;
      }

      await prisma.ilanKaynagi.update({
        where: { id: aday.id },
        data: { sonHata: mesaj.slice(0, 300) },
      });
      throw e;
    }
  } finally {
    await client.disconnect().catch(() => null);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
