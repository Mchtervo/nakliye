/**
 * Onaylanmış gruplardan çık — günde max 3, arası ≥30 dk.
 * LeaveChannel + PASIF.
 */
import { Api, TelegramClient, errors } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, aiTercihleriOku, ayarOku, ayarYaz } from "@/lib/ayarlar";
import {
  CIKIS_ARA_MS,
  CIKIS_GUNLUK_LIMIT,
  GRUP_CIKIS_GUNLUK_ANAHTAR,
  GRUP_CIKIS_SON_ANAHTAR,
  cikisGunlukOku,
  cikisKuyrukOku,
  grubuPasifYap,
} from "@/lib/kaynaklar/grupTemizlik";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";

async function kuyrukYaz(idler: number[], sebepler: Record<string, string>) {
  const anahtar = "grup_cikis_kuyruk";
  if (idler.length === 0) {
    await prisma.ayar.delete({ where: { anahtar } }).catch(() => null);
    return;
  }
  await prisma.ayar.upsert({
    where: { anahtar },
    create: {
      anahtar,
      deger: JSON.stringify({ idler, sebepler }),
    },
    update: { deger: JSON.stringify({ idler, sebepler }) },
  });
}

async function main() {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramUyeAcik) {
    console.log("[grup-cik] üye tarama kapalı — atlandı.");
    return;
  }

  const flood = Date.parse(
    (await ayarOku(AYAR_ANAHTARLARI.telegramFloodBitis)) || ""
  );
  if (Number.isFinite(flood) && Date.now() < flood) {
    console.log(`[grup-cik] FloodWait kilitli → ${new Date(flood).toISOString()}`);
    return;
  }

  const sayac = cikisGunlukOku(
    (await prisma.ayar.findUnique({ where: { anahtar: GRUP_CIKIS_GUNLUK_ANAHTAR } }))
      ?.deger ?? null
  );
  if (sayac.adet >= CIKIS_GUNLUK_LIMIT) {
    console.log(`[grup-cik] günlük limit ${sayac.adet}/${CIKIS_GUNLUK_LIMIT}`);
    return;
  }

  const sonHam = (
    await prisma.ayar.findUnique({ where: { anahtar: GRUP_CIKIS_SON_ANAHTAR } })
  )?.deger;
  const sonMs = Date.parse(sonHam || "");
  if (Number.isFinite(sonMs) && Date.now() - sonMs < CIKIS_ARA_MS) {
    const kalan = Math.ceil((CIKIS_ARA_MS - (Date.now() - sonMs)) / 60000);
    console.log(`[grup-cik] ara: ${kalan} dk sonra`);
    return;
  }

  const kuyruk = await cikisKuyrukOku();
  if (kuyruk.idler.length === 0) {
    console.log("[grup-cik] kuyruk boş");
    return;
  }

  const id = kuyruk.idler[0];
  const sebep = kuyruk.sebepler[String(id)] || "onaylı çıkış";
  const grup = await prisma.ilanKaynagi.findFirst({
    where: { id, tur: TELEGRAM_UYE },
  });
  if (!grup) {
    await kuyrukYaz(
      kuyruk.idler.slice(1),
      kuyruk.sebepler
    );
    console.log("[grup-cik] grup yok, kuyruktan silindi", id);
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

  try {
    const peer = grup.kullaniciAdi
      ? await client.getInputEntity(grup.kullaniciAdi.replace(/^@/, ""))
      : await client.getInputEntity(grup.hedef);

    await client.invoke(new Api.channels.LeaveChannel({ channel: peer }));
    await grubuPasifYap(grup.id, sebep);

    await prisma.ayar.upsert({
      where: { anahtar: GRUP_CIKIS_SON_ANAHTAR },
      create: {
        anahtar: GRUP_CIKIS_SON_ANAHTAR,
        deger: new Date().toISOString(),
      },
      update: { deger: new Date().toISOString() },
    });
    await prisma.ayar.upsert({
      where: { anahtar: GRUP_CIKIS_GUNLUK_ANAHTAR },
      create: {
        anahtar: GRUP_CIKIS_GUNLUK_ANAHTAR,
        deger: `${sayac.gun}:${sayac.adet + 1}`,
      },
      update: { deger: `${sayac.gun}:${sayac.adet + 1}` },
    });

    const kalanIdler = kuyruk.idler.slice(1);
    const sebepler = { ...kuyruk.sebepler };
    delete sebepler[String(id)];
    await kuyrukYaz(kalanIdler, sebepler);

    console.log(
      JSON.stringify({
        ok: true,
        cikildi: grup.ad,
        sebep,
        bugun: `${sayac.adet + 1}/${CIKIS_GUNLUK_LIMIT}`,
        kuyrukKalan: kalanIdler.length,
      })
    );
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);

    if (e instanceof errors.FloodWaitError) {
      const kilit = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await ayarYaz(AYAR_ANAHTARLARI.telegramFloodBitis, kilit.toISOString());
      console.error(`[grup-cik] FloodWait ${e.seconds}s → 24s kilit`);
      throw e;
    }

    // Zaten üye değil / kanal değil → yine PASIF
    if (
      /USER_NOT_PARTICIPANT|CHANNEL_PRIVATE|PEER_ID_INVALID|not a member/i.test(
        mesaj
      )
    ) {
      await grubuPasifYap(grup.id, `${sebep} (zaten üye değil)`);
      const kalanIdler = kuyruk.idler.slice(1);
      const sebepler = { ...kuyruk.sebepler };
      delete sebepler[String(id)];
      await kuyrukYaz(kalanIdler, sebepler);
      console.log("[grup-cik] zaten üye değil → PASIF", grup.ad);
      return;
    }

    await prisma.ilanKaynagi.update({
      where: { id: grup.id },
      data: { sonHata: `Çıkış hata: ${mesaj}`.slice(0, 300) },
    });
    throw e;
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
