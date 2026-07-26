import { aiAracli, aiKapaliMi } from "@/lib/ai/istemci";
import { aiTercihleriOku, type AiTercihleri } from "@/lib/ayarlar";
import { aracTipiAdi } from "@/lib/arac";
import { bolgeAdi } from "@/lib/bolgeler";
import { araciCalistir, BOT_ARAC_TANIMLARI, ilanAra } from "@/lib/bot/araclar";
import {
  botGunlukLimitArtir,
  botGunlukLimitMusaitMi,
  sohbetHafizasiOku,
  sohbetHafizasinaEkle,
} from "@/lib/bot/hafiza";
import { ilanKarti, whatsappUrl, type KartIlan } from "@/lib/bot/kart";
import {
  telegramCallbackCevapla,
  telegramGonder,
  type InlineButon,
} from "@/lib/bildirim/telegram";
import { prisma } from "@/lib/prisma";

export type BotSohbetSonucu = {
  cevaplandi: boolean;
  not: string;
};

function tercihOzeti(t: AiTercihleri): string {
  const araclar =
    t.aracTipleri.map((k) => aracTipiAdi(k) || k).join(", ") || "belirsiz";
  const bolgeler =
    t.bolgeler.map((b) => bolgeAdi(b)).join(", ") || "tümü";
  return [
    `Ana üs: ${t.anaUs || t.sehir || "yok"}`,
    `Araç: ${araclar}`,
    `Max tonaj: ${t.maxTonaj ?? "yok"}`,
    `Bölgeler: ${bolgeler}`,
    t.ekIller.length ? `Ek iller: ${t.ekIller.join(", ")}` : null,
    t.rotalar.length ? `Rotalar: ${t.rotalar.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function sistemPrompt(t: AiTercihleri): string {
  return [
    "Sen Yük Avcısı Telegram asistanısın. Kısa Türkçe cevap ver.",
    "Kullanıcı doğal dilde yük sorar; araçları kullanarak veritabanından bak.",
    "En fazla 5 ilan özetle. Daha fazla varsa 'N tane daha var' de.",
    "İlan kartlarını sen formatlama — sistem ayrıca kart gönderir.",
    "Sen sadece kısa özet / yönlendirme yaz.",
    "Slash komut önerme.",
    "",
    "Kullanıcı tercihleri:",
    tercihOzeti(t),
  ].join("\n");
}

function kartButonlari(ilan: KartIlan): InlineButon[] {
  const butonlar: InlineButon[] = [];
  const wa = whatsappUrl(ilan.telefon);
  if (wa) butonlar.push({ metin: "WhatsApp", url: wa });
  butonlar.push({ metin: "Takibe Al", callback: `takip:${ilan.id}` });
  butonlar.push({
    metin: "İlgilenmiyorum",
    callback: `elendi:${ilan.id}`,
  });
  return butonlar;
}

/**
 * Özel sohbet mesajı. AI_KAPALI ise OpenAI çağrılmaz.
 */
export async function botSohbetIsle(
  chatId: string,
  metin: string
): Promise<BotSohbetSonucu> {
  const tercih = await aiTercihleriOku();
  if (!tercih.telegramChatId || tercih.telegramChatId !== chatId) {
    console.warn("[bot] yetkisiz chat", chatId);
    return { cevaplandi: false, not: "Yetkisiz sohbet." };
  }

  const kota = await botGunlukLimitMusaitMi();
  if (!kota.musait) {
    await telegramGonder(
      chatId,
      `Günlük bot mesaj limitine ulaşıldı (${kota.limit}). Yarın devam.`
    );
    return { cevaplandi: true, not: "Günlük limit." };
  }

  if (aiKapaliMi()) {
    await telegramGonder(
      chatId,
      "AI şu an kapalı. Açılınca buradan doğal Türkçe sorabilirsin (ör. «ankara yük var mı»)."
    );
    await botGunlukLimitArtir();
    await sohbetHafizasinaEkle(metin, "AI şu an kapalı.");
    return { cevaplandi: true, not: "AI kapalı." };
  }

  const hafiza = await sohbetHafizasiOku();
  const mesajlar = [
    ...hafiza,
    { rol: "user" as const, metin },
  ];

  let yakalanan: KartIlan[] = [];
  let yakalananToplam = 0;

  let cevapMetni: string;
  try {
    cevapMetni = await aiAracli({
      sistem: sistemPrompt(tercih),
      mesajlar,
      araclar: BOT_ARAC_TANIMLARI,
      kaynak: "bot-sohbet",
      maxCikti: 800,
      maxTur: 4,
      araciCalistir: async (ad, argsJson) => {
        const sonuc = await araciCalistir(ad, argsJson);
        if (
          ad === "ilanAra" &&
          sonuc &&
          typeof sonuc === "object" &&
          "ilanlar" in sonuc
        ) {
          const s = sonuc as { toplam: number; ilanlar: KartIlan[] };
          yakalanan = s.ilanlar;
          yakalananToplam = s.toplam;
        }
        if (
          ad === "ilanDetay" &&
          sonuc &&
          typeof sonuc === "object" &&
          "id" in sonuc
        ) {
          yakalanan = [sonuc as KartIlan];
          yakalananToplam = 1;
        }
        return sonuc;
      },
    });
  } catch (e) {
    const hata = e instanceof Error ? e.message : "Bilinmeyen hata";
    await telegramGonder(chatId, `Şu an yanıt veremedim: ${hata.slice(0, 180)}`);
    await botGunlukLimitArtir();
    return { cevaplandi: true, not: hata };
  }

  if (!cevapMetni.trim() && yakalanan.length === 0) {
    const s = await ilanAra({
      cikisIl: tercih.anaUs || tercih.sehir,
      maxTonaj: tercih.maxTonaj,
      sonSaat: 48,
      limit: 5,
    });
    yakalanan = s.ilanlar;
    yakalananToplam = s.toplam;
    cevapMetni =
      s.toplam > 0 ? `${s.toplam} ilan buldum:` : "Uygun ilan bulamadım.";
  }

  await telegramGonder(chatId, cevapMetni.slice(0, 3500));

  for (const ilan of yakalanan.slice(0, 5)) {
    await telegramGonder(chatId, ilanKarti(ilan), kartButonlari(ilan));
  }

  if (yakalananToplam > yakalanan.length) {
    const kalan = yakalananToplam - yakalanan.length;
    await telegramGonder(chatId, `${kalan} tane daha var.`);
  }

  await sohbetHafizasinaEkle(metin, cevapMetni);
  await botGunlukLimitArtir();

  return { cevaplandi: true, not: "Sohbet yanıtlandı." };
}

/** Inline buton: takip / elendi. */
export async function botCallbackIsle(guncelleme: {
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number };
    message?: { chat?: { id?: number } };
  };
}): Promise<BotSohbetSonucu> {
  const cq = guncelleme.callback_query;
  if (!cq?.id || !cq.data) {
    return { cevaplandi: false, not: "Callback yok." };
  }

  const tercih = await aiTercihleriOku();
  const chatId = String(cq.message?.chat?.id || cq.from?.id || "");
  if (!tercih.telegramChatId || tercih.telegramChatId !== chatId) {
    await telegramCallbackCevapla(cq.id, "Yetkisiz.");
    console.warn("[bot] yetkisiz callback", chatId);
    return { cevaplandi: false, not: "Yetkisiz callback." };
  }

  const [islem, idHam] = cq.data.split(":");
  const id = Number(idHam);
  if (!Number.isFinite(id) || id <= 0) {
    await telegramCallbackCevapla(cq.id, "Geçersiz.");
    return { cevaplandi: false, not: "Geçersiz data." };
  }

  if (islem === "takip") {
    await prisma.yukIlani.update({
      where: { id },
      data: { durum: "ILGILENIYOR" },
    });
    await telegramCallbackCevapla(cq.id, "Takibe alındı.");
    return { cevaplandi: true, not: `takip:${id}` };
  }

  if (islem === "elendi") {
    await prisma.yukIlani.update({
      where: { id },
      data: { durum: "ELENDI" },
    });
    await telegramCallbackCevapla(cq.id, "Elendi.");
    return { cevaplandi: true, not: `elendi:${id}` };
  }

  await telegramCallbackCevapla(cq.id, "Bilinmeyen işlem.");
  return { cevaplandi: false, not: "Bilinmeyen callback." };
}
