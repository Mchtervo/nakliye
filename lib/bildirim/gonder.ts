import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { htmlKacis, telegramGonder, telegramKullanilabilir } from "@/lib/bildirim/telegram";
import { pushGonder, pushKullanilabilir } from "@/lib/bildirim/push";
import { ilanKarti } from "@/lib/bot/kart";
import { SUPHE_SINIRI } from "@/lib/kaynaklar/filtre";
import {
  tdmKartButonlari,
} from "@/lib/kaynaklar/telegramDm";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";

export type BildirimSonucu = {
  telegram: number;
  push: number;
  hatalar: string[];
  /** Sessiz saatte beklemeye alınan (sabah özeti). */
  ertelenen: number;
};

/** Gece sessiz: 23:00–07:00 Europe/Istanbul. */
export function bildirimSessizMi(tarih = new Date()): boolean {
  const saat = new Date(tarih.getTime() + 3 * 60 * 60 * 1000).getUTCHours();
  return saat >= 23 || saat < 7;
}

/** Sessiz saatte bile giden acil eşik. */
export const BILDIRIM_ACIL_SKOR = 90;

function siteAdresi(): string {
  return (
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

function pushMetni(ilan: KaydedilenIlan): string {
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  const firma = ilan.firmaAdi ? ` · ${ilan.firmaAdi}` : "";
  const tel = ilan.telefon ? ` · ${ilan.telefon}` : "";
  return `${rota}${firma}${tel}`;
}

function kartMetni(ilan: KaydedilenIlan, donusMu: boolean): string {
  const baslik = donusMu ? "<b>DÖNÜŞ YÜKÜ</b>\n" : "";
  return (
    baslik +
    ilanKarti({
      id: ilan.id,
      nereden: ilan.nereden,
      nereye: ilan.nereye,
      cikisIl: ilan.cikisIl,
      varisIl: ilan.varisIl,
      tonaj: ilan.tonaj,
      aracTipi: ilan.aracTipi,
      yukTipi: null,
      yuklemeTarihi: null,
      ucret: ilan.ucret,
      fiyatTon: ilan.fiyatTon,
      fiyatBelirsiz: false,
      telefon: ilan.telefon,
      firmaAdi: ilan.firmaAdi,
      ilgiliKisi: ilan.ilgiliKisi,
      guvenSkoru: ilan.guvenSkoru,
      createdAt: ilan.createdAt ?? new Date(),
      kaynakAd: ilan.kaynakAd ?? null,
    })
  );
}

/** Yeni bulunan ilanları kullanıcıya bildirir ve kaydı tutar. */
export async function yukIlanlariniBildir(
  ilanlar: KaydedilenIlan[]
): Promise<BildirimSonucu> {
  const sonuc: BildirimSonucu = {
    telegram: 0,
    push: 0,
    hatalar: [],
    ertelenen: 0,
  };
  const guvenli = ilanlar.filter((i) => i.guvenSkoru >= SUPHE_SINIRI);
  if (guvenli.length === 0) return sonuc;

  const tercih = await aiTercihleriOku();
  const kok = siteAdresi();
  const sessiz = bildirimSessizMi();
  const gonderilenIdler: number[] = [];

  for (const ilan of guvenli.slice(0, 10)) {
    if (sessiz && ilan.guvenSkoru < BILDIRIM_ACIL_SKOR) {
      sonuc.ertelenen += 1;
      continue;
    }

    const donusMu = Boolean(ilan.donusTalebiId);
    const baslik = donusMu ? "Dönüş yükü bulundu" : "Yeni yük bulundu";
    const metin = kartMetni(ilan, donusMu);
    let butonSatirlari: Awaited<ReturnType<typeof tdmKartButonlari>> = null;

    if (ilan.gonderenUserId || ilan.telefon) {
      try {
        butonSatirlari = await tdmKartButonlari({
          id: ilan.id,
          gonderenUserId: ilan.gonderenUserId ?? null,
          telefon: ilan.telefon,
        });
      } catch (e) {
        console.warn(
          "[bildirim] tdmKartButonlari",
          e instanceof Error ? e.message : e
        );
      }
    }

    if (tercih.telegramAcik && tercih.telegramChatId && telegramKullanilabilir()) {
      const butonlar =
        butonSatirlari ||
        (kok
          ? [
              [
                {
                  metin: "Detay",
                  url: `${kok}/ai/yukler?sekme=HEPSI&id=${ilan.id}`,
                },
              ],
            ]
          : undefined);

      const cevap = await telegramGonder(
        tercih.telegramChatId,
        metin,
        butonlar
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
        url: `/ai/yukler?sekme=HEPSI&id=${ilan.id}`,
      });
      sonuc.push += cevap.gonderilen;
      if (cevap.hata) sonuc.hatalar.push(cevap.hata);
    }

    gonderilenIdler.push(ilan.id);
  }

  if (gonderilenIdler.length > 0) {
    await prisma.yukIlani.updateMany({
      where: { id: { in: gonderilenIdler } },
      data: { bildirildi: true },
    });
  }

  return sonuc;
}

/**
 * Sessiz saatte biriken (bildirilmemiş) ilanların sabah özeti.
 * Cron: 07:05 Europe/Istanbul.
 */
export async function sabahOzetBildir(): Promise<{
  adet: number;
  gonderildi: boolean;
}> {
  if (bildirimSessizMi()) {
    return { adet: 0, gonderildi: false };
  }

  const sinir = new Date(Date.now() - 14 * 60 * 60 * 1000);
  const bekleyen = await prisma.yukIlani.findMany({
    where: {
      bildirildi: false,
      guvenSkoru: { gte: SUPHE_SINIRI },
      createdAt: { gte: sinir },
      durum: { in: ["YENI", "ILGILENIYOR"] },
    },
    orderBy: [{ guvenSkoru: "desc" }, { createdAt: "desc" }],
    take: 25,
    include: { kaynak: { select: { ad: true } } },
  });

  if (bekleyen.length === 0) return { adet: 0, gonderildi: false };

  const tercih = await aiTercihleriOku();
  const { ilgiliMi } = await import("@/lib/kaynaklar/filtre");
  const uygun = bekleyen.filter((i) =>
    ilgiliMi(
      {
        id: i.id,
        firmaAdi: i.firmaAdi,
        ilgiliKisi: i.ilgiliKisi,
        telefon: i.telefon,
        nereden: i.nereden,
        nereye: i.nereye,
        cikisIl: i.cikisIl,
        varisIl: i.varisIl,
        ucret: i.ucret,
        fiyatTon: i.fiyatTon,
        tonaj: i.tonaj,
        aracTipi: i.aracTipi,
        aracTipiKod: i.aracTipiKod,
        guvenSkoru: i.guvenSkoru,
        hamMetin: i.hamMetin,
        donusTalebiId: i.donusTalebiId,
        createdAt: i.createdAt,
        kaynakAd: i.kaynak?.ad ?? null,
      },
      tercih
    )
  );

  if (uygun.length === 0) return { adet: 0, gonderildi: false };

  const kok = siteAdresi();
  const ozetSatirlar = uygun.slice(0, 12).map((i) => {
    const rota = `${i.cikisIl || i.nereden || "?"}→${i.varisIl || i.nereye || "?"}`;
    return `• ${htmlKacis(rota)}${i.firmaAdi ? ` · ${htmlKacis(i.firmaAdi)}` : ""} · %${i.guvenSkoru}`;
  });

  const metin =
    `<b>Sabah özeti</b> — gece biriken ${uygun.length} yük\n\n` +
    ozetSatirlar.join("\n") +
    (uygun.length > 12 ? `\n… +${uygun.length - 12} daha` : "");

  if (tercih.telegramAcik && tercih.telegramChatId && telegramKullanilabilir()) {
    await telegramGonder(
      tercih.telegramChatId,
      metin,
      kok
        ? [{ metin: "Listeye git", url: `${kok}/ai/yukler` }]
        : undefined
    );
  }

  if (tercih.pushAcik && pushKullanilabilir()) {
    await pushGonder({
      baslik: `Sabah: ${uygun.length} yük`,
      metin: ozetSatirlar[0]?.replace(/<[^>]+>/g, "") || "Gece biriken yükler",
      url: "/ai/yukler",
    });
  }

  await prisma.yukIlani.updateMany({
    where: { id: { in: uygun.map((i) => i.id) } },
    data: { bildirildi: true },
  });

  return { adet: uygun.length, gonderildi: true };
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
