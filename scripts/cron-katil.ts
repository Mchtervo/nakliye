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

/** Çöp ADAY'ları PASİF yap; koridor başlıklıları öne al. */
async function adaySec(haric: Set<number>): Promise<{
  id: number;
  ad: string;
  kullaniciAdi: string | null;
  hedef: string;
} | null> {
  const minUye = await katilimMinUyeOku();
  const adaylar = await prisma.ilanKaynagi.findMany({
    where: {
      tur: TELEGRAM_UYE,
      durum: "ADAY",
      aktif: true,
      kullaniciAdi: { not: null },
      id: haric.size > 0 ? { notIn: [...haric] } : undefined,
      OR: [{ uyeSayisi: null }, { uyeSayisi: { gte: minUye } }],
    },
    orderBy: [{ oncelik: "desc" }, { uyeSayisi: "desc" }, { id: "asc" }],
    take: 40,
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

  const uygun: {
    id: number;
    ad: string;
    kullaniciAdi: string | null;
    hedef: string;
    skor: number;
  }[] = [];

  for (const a of adaylar) {
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
    const koridor = koridorBaslikOnceligi(a.ad);
    const skor =
      (a.oncelik ?? 0) +
      koridor * 10 +
      Math.min(a.uyeSayisi ?? 0, 5000) / 5000;
    if (koridor > 0 && (a.oncelik ?? 0) < 10 + koridor) {
      await prisma.ilanKaynagi
        .update({
          where: { id: a.id },
          data: { oncelik: 10 + koridor },
        })
        .catch(() => null);
    }
    uygun.push({
      id: a.id,
      ad: a.ad,
      kullaniciAdi: a.kullaniciAdi,
      hedef: a.hedef,
      skor,
    });
  }

  uygun.sort((x, y) => y.skor - x.skor);
  return uygun[0] ?? null;
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

  const client = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 3,
    autoReconnect: false,
  });
  await client.connect();

  const haric = new Set<number>();
  let aday: Awaited<ReturnType<typeof adaySec>> = null;
  try {
    for (let i = 0; i < 8; i++) {
      aday = await adaySec(haric);
      if (!aday?.kullaniciAdi) {
        console.log("[cron-katil] uygun ADAY yok");
        return;
      }
      haric.add(aday.id);
      const ok = await icerikUygunMu(client, {
        id: aday.id,
        ad: aday.ad,
        kullaniciAdi: aday.kullaniciAdi,
      });
      if (ok) break;
      aday = null;
    }
    if (!aday?.kullaniciAdi) {
      console.log("[cron-katil] içerik uygun ADAY kalmadı");
      return;
    }

    const kullanici = aday.kullaniciAdi.replace(/^@/, "");
    console.log(`[cron-katil] deneme @${kullanici} (${aday.ad})`);

    try {
      const entity = await client.getEntity(kullanici);
      const channel = await client.getInputEntity(entity);
      await client.invoke(new Api.channels.JoinChannel({ channel }));

      const chatId = String(utils.getPeerId(entity));
      const baslik =
        entity instanceof Api.Channel && entity.title
          ? entity.title
          : aday.ad;

      const cakisan = await prisma.ilanKaynagi.findFirst({
        where: {
          tur: TELEGRAM_UYE,
          hedef: chatId,
          id: { not: aday.id },
        },
        select: { id: true },
      });
      if (cakisan) {
        await prisma.ilanKaynagi.update({
          where: { id: aday.id },
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
      } else {
        await prisma.ilanKaynagi.update({
          where: { id: aday.id },
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
        try {
          const entity = await client.getEntity(kullanici);
          const chatId = String(utils.getPeerId(entity));
          const baslik =
            entity instanceof Api.Channel && entity.title
              ? entity.title
              : aday.ad;
          const cakisan = await prisma.ilanKaynagi.findFirst({
            where: {
              tur: TELEGRAM_UYE,
              hedef: chatId,
              id: { not: aday.id },
            },
            select: { id: true },
          });
          if (!cakisan) {
            await prisma.ilanKaynagi.update({
              where: { id: aday.id },
              data: {
                hedef: chatId,
                ad: baslik.slice(0, 120),
                durum: "AKTIF",
                aktif: true,
                sonHata: null,
              },
            });
          } else {
            await prisma.ilanKaynagi.update({
              where: { id: aday.id },
              data: {
                aktif: false,
                durum: "PASIF",
                sonHata: `Zaten üye; kayıt #${cakisan.id}`,
              },
            });
          }
        } catch {
          await prisma.ilanKaynagi.update({
            where: { id: aday.id },
            data: { durum: "AKTIF", aktif: true, sonHata: null },
          });
        }
        console.log("[cron-katil] zaten üye → AKTİF", aday.ad);
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
