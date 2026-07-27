import { prisma } from "@/lib/prisma";
import { ilanlariCozumle } from "@/lib/ai/ilanCozumle";
import { AYAR_ANAHTARLARI, ayarYaz } from "@/lib/ayarlar";
import { telegramGonder } from "@/lib/bildirim/telegram";
import { botCallbackIsle, botSohbetIsle } from "@/lib/bot/sohbet";
import { ilanlariKaydet, type KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

export type TelegramGuncelleme = {
  message?: TelegramMesaj;
  channel_post?: TelegramMesaj;
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number };
    message?: { chat?: { id?: number }; message_id?: number };
  };
};

type TelegramMesaj = {
  text?: string;
  caption?: string;
  chat?: { id?: number; title?: string; type?: string; username?: string };
  from?: { first_name?: string; username?: string };
};

export type WebhookSonucu = {
  islendi: boolean;
  yeniIlanlar: KaydedilenIlan[];
  not: string;
};

function bos(not: string): WebhookSonucu {
  return { islendi: false, yeniIlanlar: [], not };
}

/** Grup mesajını kaynağa bağlar; kaynak yoksa otomatik oluşturur. */
async function kaynagiBulVeyaOlustur(
  chatId: string,
  baslik: string
): Promise<number> {
  const mevcut = await prisma.ilanKaynagi.findUnique({
    where: { tur_hedef: { tur: "TELEGRAM", hedef: chatId } },
  });
  if (mevcut) return mevcut.id;

  const yeni = await prisma.ilanKaynagi.create({
    data: { tur: "TELEGRAM", ad: baslik, hedef: chatId },
  });
  return yeni.id;
}

export async function telegramGuncellemeIsle(
  guncelleme: TelegramGuncelleme
): Promise<WebhookSonucu> {
  if (guncelleme.callback_query) {
    const cb = await botCallbackIsle(guncelleme);
    return {
      islendi: cb.cevaplandi,
      yeniIlanlar: [],
      not: cb.not,
    };
  }

  const mesaj = guncelleme.message || guncelleme.channel_post;
  if (!mesaj) return bos("Mesaj yok.");

  const metin = (mesaj.text || mesaj.caption || "").trim();
  const chatId = mesaj.chat?.id;
  if (!chatId) return bos("Sohbet kimliği yok.");
  if (!metin) return bos("Metin yok.");

  const chatIdMetin = String(chatId);
  const ozelMi = mesaj.chat?.type === "private";

  // Kullanıcı kendi sohbetinden botu bağlıyor.
  if (ozelMi && /^\/(baglan|start)\b/i.test(metin)) {
    await ayarYaz(AYAR_ANAHTARLARI.telegramChatId, chatIdMetin);
    await telegramGonder(
      chatIdMetin,
      [
        "<b>Bağlandı.</b>",
        "",
        "Bundan sonra bulunan yükler buraya düşecek.",
        "",
        "Doğal Türkçe yazabilirsin:",
        "«ankara yük var mı» · «bugün kaç ilan» · «bu ay ne kazandım»",
        "«AI kaç dolar yaktı» · «3 günlük tur planla»",
        "AI kapalıysa kayıtlı ilan araması yine çalışır.",
      ].join("\n")
    );
    return { islendi: true, yeniIlanlar: [], not: "Bildirim hedefi kaydedildi." };
  }

  // Özel sohbet = doğal dil botu (FAZ 6). Slash komut yok.
  if (ozelMi) {
    if (metin.startsWith("/")) return bos("Komut yoksayıldı.");
    const sohbet = await botSohbetIsle(chatIdMetin, metin);
    return {
      islendi: sohbet.cevaplandi,
      yeniIlanlar: [],
      not: sohbet.not,
    };
  }

  if (metin.startsWith("/")) return bos("Komut yoksayıldı.");

  const kaynakId = await kaynagiBulVeyaOlustur(
    chatIdMetin,
    mesaj.chat?.title || mesaj.chat?.username || `Telegram ${chatIdMetin}`
  );

  let ilanlar;
  try {
    ilanlar = await ilanlariCozumle(metin);
  } catch (hata) {
    const mesajMetni = hata instanceof Error ? hata.message : "Çözümleme hatası";
    await prisma.ilanKaynagi.update({
      where: { id: kaynakId },
      data: { sonHata: mesajMetni, sonTarama: new Date() },
    });
    return bos(mesajMetni);
  }

  if (ilanlar.length === 0) {
    await prisma.ilanKaynagi.update({
      where: { id: kaynakId },
      data: { sonTarama: new Date(), sonHata: null },
    });
    return bos("İlan bulunamadı.");
  }

  const yeniIlanlar = await ilanlariKaydet(
    kaynakId,
    ilanlar.map((ilan) => ({ ilan, hamMetin: metin }))
  );

  await prisma.ilanKaynagi.update({
    where: { id: kaynakId },
    data: {
      sonTarama: new Date(),
      sonHata: null,
      bulunanAdet: { increment: yeniIlanlar.length },
    },
  });

  return {
    islendi: true,
    yeniIlanlar,
    not: `${yeniIlanlar.length} yeni ilan.`,
  };
}
