/**
 * Bildirim teşhis + test gönderimi.
 */
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, aiTercihleriOku, ayarOku } from "@/lib/ayarlar";
import {
  bildirimSessizMi,
  BILDIRIM_ACIL_SKOR,
} from "@/lib/bildirim/gonder";
import {
  telegramGonder,
  telegramKullanilabilir,
  htmlKacis,
} from "@/lib/bildirim/telegram";

async function main() {
  const simdi = new Date();
  const altiSaat = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const tercih = await aiTercihleriOku();

  const chatId =
    (await ayarOku(AYAR_ANAHTARLARI.telegramChatId)) || tercih.telegramChatId;
  const bildirimTg = await ayarOku(AYAR_ANAHTARLARI.bildirimTelegram);
  const bildirimPush = await ayarOku(AYAR_ANAHTARLARI.bildirimPush);

  const tr = new Date(simdi.getTime() + 3 * 60 * 60 * 1000);
  const trSaat = tr.getUTCHours();
  const trDk = tr.getUTCMinutes();

  console.log("=== ORTAM ===");
  console.log(`bot_token var mı: ${telegramKullanilabilir()}`);
  console.log(
    `telegram_chat_id: ${
      chatId ? `${chatId.slice(0, 4)}…${chatId.slice(-3)} (len=${chatId.length})` : "YOK"
    }`
  );
  console.log(
    `bildirim_telegram=${bildirimTg ?? "(yok→açık)"} telegramAcik=${tercih.telegramAcik}`
  );
  console.log(
    `bildirim_push=${bildirimPush ?? "(yok→açık)"} pushAcik=${tercih.pushAcik}`
  );
  console.log(
    `şimdi UTC=${simdi.toISOString()} TR≈${String(trSaat).padStart(2, "0")}:${String(trDk).padStart(2, "0")}`
  );
  console.log(
    `bildirimSessizMi=${bildirimSessizMi(simdi)} (23–07 TR, acil≥${BILDIRIM_ACIL_SKOR})`
  );

  // Saat doğrulama örnekleri
  for (const h of [19, 22, 23, 0, 6, 7]) {
    const d = new Date(`2026-07-27T${String(h).padStart(2, "0")}:30:00+03:00`);
    console.log(
      `  örnek TR ${h}:30 → sessiz=${bildirimSessizMi(d)}`
    );
  }

  const [son6, gonderildi6, hata6, bekliyor6, sonBildirim] = await Promise.all([
    prisma.bildirim.count({ where: { createdAt: { gte: altiSaat } } }),
    prisma.bildirim.count({
      where: { createdAt: { gte: altiSaat }, durum: "GONDERILDI" },
    }),
    prisma.bildirim.count({
      where: { createdAt: { gte: altiSaat }, durum: "HATA" },
    }),
    prisma.bildirim.count({
      where: { createdAt: { gte: altiSaat }, durum: "BEKLIYOR" },
    }),
    prisma.bildirim.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kanal: true,
        durum: true,
        hata: true,
        createdAt: true,
        baslik: true,
        metin: true,
      },
    }),
  ]);

  console.log("\n=== SON 6 SAAT Bildirim ===");
  console.log(
    `toplam=${son6} GONDERILDI=${gonderildi6} HATA=${hata6} BEKLIYOR=${bekliyor6}`
  );

  if (sonBildirim) {
    const dk = Math.round(
      (Date.now() - sonBildirim.createdAt.getTime()) / 60000
    );
    console.log("\n=== SON BİLDİRİM ===");
    console.log(
      `#${sonBildirim.id} ${sonBildirim.createdAt.toISOString()} (${dk} dk önce)`
    );
    console.log(
      `kanal=${sonBildirim.kanal} durum=${sonBildirim.durum} baslik=${sonBildirim.baslik}`
    );
    console.log(`metin=${(sonBildirim.metin || "").slice(0, 100)}`);
    console.log(`hata=${(sonBildirim.hata || "-").slice(0, 200)}`);
  } else {
    console.log("\n=== SON BİLDİRİM: hiç kayıt yok ===");
  }

  const sonHatalar = await prisma.bildirim.findMany({
    where: { durum: "HATA" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, createdAt: true, hata: true, kanal: true, baslik: true },
  });
  if (sonHatalar.length) {
    console.log("\n=== SON HATALAR ===");
    for (const h of sonHatalar) {
      console.log(
        `#${h.id} ${h.createdAt.toISOString()} ${h.kanal}: ${(h.hata || "").slice(0, 150)}`
      );
    }
  }

  const sonIlanlar = await prisma.yukIlani.findMany({
    where: { createdAt: { gte: altiSaat } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      nereden: true,
      nereye: true,
      guvenSkoru: true,
      bildirildi: true,
      createdAt: true,
    },
  });
  console.log("\n=== SON İLANLAR (6s) ===");
  for (const i of sonIlanlar) {
    console.log(
      `#${i.id} skor=${i.guvenSkoru} bildirildi=${i.bildirildi} ` +
        `${i.nereden}→${i.nereye} ${i.createdAt.toISOString()}`
    );
  }

  console.log("\n=== TEST GÖNDERİM ===");
  if (!chatId) {
    console.log("ATLANDI: telegram_chat_id yok — /baglan gerekir");
    return;
  }
  if (!telegramKullanilabilir()) {
    console.log("ATLANDI: TELEGRAM_BOT_TOKEN yok");
    return;
  }
  const metin =
    `<b>Yük Avcısı — test bildirimi</b>\n` +
    `${htmlKacis(
      new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
    )}\n` +
    `Sessiz saat şu an: <b>${bildirimSessizMi() ? "EVET" : "hayır"}</b>`;
  const sonuc = await telegramGonder(chatId, metin);
  console.log(JSON.stringify(sonuc));

  await prisma.bildirim.create({
    data: {
      kanal: "TELEGRAM",
      hedef: chatId,
      baslik: "Test bildirimi",
      metin: "manuel test",
      durum: sonuc.basarili ? "GONDERILDI" : "HATA",
      hata: sonuc.hata,
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
