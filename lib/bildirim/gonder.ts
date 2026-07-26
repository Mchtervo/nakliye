import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { tlYaz } from "@/lib/para";
import { htmlKacis, telegramGonder, telegramKullanilabilir } from "@/lib/bildirim/telegram";
import { pushGonder, pushKullanilabilir } from "@/lib/bildirim/push";
import { SUPHE_SINIRI } from "@/lib/kaynaklar/filtre";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

export type BildirimSonucu = {
  telegram: number;
  push: number;
  hatalar: string[];
};

function siteAdresi(): string {
  return (
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

function ilanMetni(ilan: KaydedilenIlan, donusMu: boolean): string {
  const satirlar = [
    donusMu ? "<b>DÖNÜŞ YÜKÜ BULUNDU</b>" : "<b>YENİ YÜK</b>",
    `${htmlKacis(ilan.nereden || ilan.cikisIl || "?")} → ${htmlKacis(
      ilan.nereye || ilan.varisIl || "?"
    )}`,
  ];

  if (ilan.ucret) satirlar.push(`Ücret: <b>${htmlKacis(tlYaz(ilan.ucret))}</b>`);
  if (ilan.firmaAdi) satirlar.push(`Firma: ${htmlKacis(ilan.firmaAdi)}`);
  if (ilan.ilgiliKisi) satirlar.push(`Kişi: ${htmlKacis(ilan.ilgiliKisi)}`);
  if (ilan.telefon) satirlar.push(`Telefon: <a href="tel:${ilan.telefon}">${ilan.telefon}</a>`);

  satirlar.push("", htmlKacis(ilan.hamMetin.slice(0, 400)));
  return satirlar.join("\n");
}

function pushMetni(ilan: KaydedilenIlan): string {
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  const ucret = ilan.ucret ? ` · ${tlYaz(ilan.ucret)}` : "";
  const tel = ilan.telefon ? ` · ${ilan.telefon}` : "";
  return `${rota}${ucret}${tel}`;
}

/** Yeni bulunan ilanları kullanıcıya bildirir ve kaydı tutar. */
export async function yukIlanlariniBildir(
  ilanlar: KaydedilenIlan[]
): Promise<BildirimSonucu> {
  const sonuc: BildirimSonucu = { telegram: 0, push: 0, hatalar: [] };
  // Sert kapı: şüpheli (<50) asla bildirim / Telegram cevabına düşmez.
  const guvenli = ilanlar.filter((i) => i.guvenSkoru >= SUPHE_SINIRI);
  if (guvenli.length === 0) return sonuc;

  const tercih = await aiTercihleriOku();
  const kok = siteAdresi();

  for (const ilan of guvenli.slice(0, 10)) {
    const donusMu = Boolean(ilan.donusTalebiId);
    const baslik = donusMu ? "Dönüş yükü bulundu" : "Yeni yük bulundu";

    if (tercih.telegramAcik && tercih.telegramChatId && telegramKullanilabilir()) {
      const butonlar = [];
      if (kok) {
        butonlar.push({ metin: "Uygulamada aç", url: `${kok}/ai/yukler` });
      }
      const cevap = await telegramGonder(
        tercih.telegramChatId,
        ilanMetni(ilan, donusMu),
        butonlar.length ? butonlar : undefined
      );

      await prisma.bildirim.create({
        data: {
          kanal: "TELEGRAM",
          hedef: tercih.telegramChatId,
          baslik,
          metin: pushMetni(ilan),
          durum: cevap.basarili ? "GONDERILDI" : "HATA",
          hata: cevap.hata,
        },
      });

      if (cevap.basarili) sonuc.telegram += 1;
      else if (cevap.hata) sonuc.hatalar.push(cevap.hata);
    }

    if (tercih.pushAcik && pushKullanilabilir()) {
      const cevap = await pushGonder({
        baslik,
        metin: pushMetni(ilan),
        url: "/ai/yukler",
      });
      sonuc.push += cevap.gonderilen;
      if (cevap.hata) sonuc.hatalar.push(cevap.hata);
    }
  }

  await prisma.yukIlani.updateMany({
    where: { id: { in: guvenli.map((i) => i.id) } },
    data: { bildirildi: true },
  });

  return sonuc;
}

/** Serbest metinli tekil bildirim (günlük analiz gibi). */
export async function bilgiBildir(
  baslik: string,
  metin: string,
  yol = "/"
): Promise<void> {
  const tercih = await aiTercihleriOku();
  const kok = siteAdresi();

  if (tercih.telegramAcik && tercih.telegramChatId && telegramKullanilabilir()) {
    const cevap = await telegramGonder(
      tercih.telegramChatId,
      `<b>${htmlKacis(baslik)}</b>\n\n${htmlKacis(metin).slice(0, 3500)}`,
      kok ? [{ metin: "Uygulamada aç", url: `${kok}${yol}` }] : undefined
    );

    await prisma.bildirim.create({
      data: {
        kanal: "TELEGRAM",
        hedef: tercih.telegramChatId,
        baslik,
        metin: metin.slice(0, 500),
        durum: cevap.basarili ? "GONDERILDI" : "HATA",
        hata: cevap.hata,
      },
    });
  }

  if (tercih.pushAcik && pushKullanilabilir()) {
    await pushGonder({ baslik, metin: metin.slice(0, 200), url: yol });
  }
}
