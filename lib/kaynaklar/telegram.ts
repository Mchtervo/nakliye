import { prisma } from "@/lib/prisma";
import { ilanlariCozumle } from "@/lib/ai/ilanCozumle";
import { AYAR_ANAHTARLARI, ayarYaz } from "@/lib/ayarlar";
import { telegramGonder } from "@/lib/bildirim/telegram";
import { ilanlariKaydet, type KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

export type TelegramGuncelleme = {
  message?: TelegramMesaj;
  channel_post?: TelegramMesaj;
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
        "Yapabileceklerin:",
        "• Beni yük gruplarına ekle, ilanları otomatik okuyayım.",
        "• Gördüğün bir ilanı bana ilet, hemen çözümleyeyim.",
      ].join("\n")
    );
    return { islendi: true, yeniIlanlar: [], not: "Bildirim hedefi kaydedildi." };
  }

  if (metin.startsWith("/")) return bos("Komut yoksayıldı.");

  const kaynakId = ozelMi
    ? null
    : await kaynagiBulVeyaOlustur(
        chatIdMetin,
        mesaj.chat?.title || mesaj.chat?.username || `Telegram ${chatIdMetin}`
      );

  let ilanlar;
  try {
    ilanlar = await ilanlariCozumle(metin);
  } catch (hata) {
    const mesajMetni = hata instanceof Error ? hata.message : "Çözümleme hatası";
    if (kaynakId) {
      await prisma.ilanKaynagi.update({
        where: { id: kaynakId },
        data: { sonHata: mesajMetni, sonTarama: new Date() },
      });
    }
    return bos(mesajMetni);
  }

  if (ilanlar.length === 0) {
    if (kaynakId) {
      await prisma.ilanKaynagi.update({
        where: { id: kaynakId },
        data: { sonTarama: new Date(), sonHata: null },
      });
    }
    if (ozelMi) {
      await telegramGonder(
        chatIdMetin,
        "Bu mesajda yük ilanı bulamadım. İlanın tamamını (şehirler, ücret, telefon) gönderirsen çözümlerim."
      );
    }
    return bos("İlan bulunamadı.");
  }

  const yeniIlanlar = await ilanlariKaydet(
    kaynakId,
    ilanlar.map((ilan) => ({ ilan, hamMetin: metin }))
  );

  if (kaynakId) {
    await prisma.ilanKaynagi.update({
      where: { id: kaynakId },
      data: {
        sonTarama: new Date(),
        sonHata: null,
        bulunanAdet: { increment: yeniIlanlar.length },
      },
    });
  }

  if (ozelMi) {
    await telegramGonder(
      chatIdMetin,
      yeniIlanlar.length > 0
        ? `${yeniIlanlar.length} ilan kaydedildi. Uygulamada "AI Yükler" ekranında görebilirsin.`
        : "Bu ilan zaten kayıtlıydı."
    );
  }

  return {
    islendi: true,
    yeniIlanlar,
    not: `${yeniIlanlar.length} yeni ilan.`,
  };
}
