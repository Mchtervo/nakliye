import { prisma } from "@/lib/prisma";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { htmlKacis, telegramGonder, telegramKullanilabilir } from "@/lib/bildirim/telegram";
import { pushGonder, pushKullanilabilir } from "@/lib/bildirim/push";
import { SUPHE_SINIRI, ilgiliMi, webKaynakHaricKosulu } from "@/lib/kaynaklar/filtre";
import { tdmKartButonlari } from "@/lib/kaynaklar/telegramDm";
import type { KaydedilenIlan } from "@/lib/kaynaklar/kaydet";
import { karHesapla } from "@/lib/karHesap";
import { tlYaz } from "@/lib/para";

export type BildirimSonucu = {
  telegram: number;
  push: number;
  hatalar: string[];
  /** Sessiz saatte beklemeye alınan (sabah özeti). */
  ertelenen: number;
  atlanan: number;
  /** Bu turda işlenen (deneme artan). */
  islenen?: number;
  /** 3 denemede vazgeçilen. */
  vazgecilen?: number;
};

/** Gece sessiz: 23:00–07:00 Europe/Istanbul. */
export function bildirimSessizMi(tarih = new Date()): boolean {
  const saat = new Date(tarih.getTime() + 3 * 60 * 60 * 1000).getUTCHours();
  return saat >= 23 || saat < 7;
}

/** Sessiz saatte bile giden acil eşik (anlık tur — kuyruk gece tamamen bekler). */
export const BILDIRIM_ACIL_SKOR = 90;

/** Telegram + push birlikte max deneme; aşınca kuyruktan düşer. */
export const BILDIRIM_MAX_DENEME = 3;

/** Bağımsız tur: tur başına üst sınır. */
export const BILDIRIM_TUR_LIMIT = 5;

function siteAdresi(): string {
  return (
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

/** Ortak metin — TG HTML + push düz. */
export function yeniYukMetni(
  ilan: KaydedilenIlan,
  maliyet: {
    yakitLt100: number;
    motorinTl: number;
    sabitTlKm: number;
    hgsTlKm: number;
    tonaj: number;
  },
  html: boolean
): string {
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  const detay = [
    ilan.tonaj ? `${ilan.tonaj}t` : null,
    ilan.aracTipi,
  ]
    .filter(Boolean)
    .join(" ");
  const kar = karHesapla(ilan, maliyet);
  const fiyat =
    ilan.ucret && ilan.ucret > 0
      ? tlYaz(ilan.ucret)
      : ilan.fiyatTon && ilan.tonaj
        ? `~${tlYaz(ilan.fiyatTon * ilan.tonaj)}`
        : null;
  const net =
    kar.netTl !== null ? `net ${tlYaz(Math.round(kar.netTl * 100))}` : null;
  const firma = ilan.firmaAdi || "FİRMA";
  const tel = ilan.telefon || "";

  const satir1 = ["YENİ YÜK", rota, detay || null, fiyat, net]
    .filter(Boolean)
    .join(" · ");
  const satir2 = [firma, tel].filter(Boolean).join(" · ");

  if (!html) return `${satir1}\n${satir2}`;
  return (
    `<b>YENİ YÜK</b> · ${htmlKacis(rota)}` +
    (detay ? ` · ${htmlKacis(detay)}` : "") +
    (fiyat ? ` · ${htmlKacis(fiyat)}` : "") +
    (net ? ` · ${htmlKacis(net)}` : "") +
    `\n${htmlKacis(firma)}${tel ? ` · ${htmlKacis(tel)}` : ""}`
  );
}

function kaydaDon(
  i: {
    id: number;
    firmaAdi: string | null;
    ilgiliKisi: string | null;
    telefon: string | null;
    nereden: string | null;
    nereye: string | null;
    cikisIl: string | null;
    varisIl: string | null;
    ucret: number | null;
    fiyatTon: number | null;
    tonaj: number | null;
    aracTipi: string | null;
    aracTipiKod: string | null;
    guvenSkoru: number;
    hamMetin: string;
    donusTalebiId: number | null;
    createdAt: Date;
    gonderenUserId?: string | null;
    kaynakMesajId?: number | null;
    hamMesajId?: number | null;
    kaynak?: { ad: string | null } | null;
  }
): KaydedilenIlan {
  return {
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
    gonderenUserId: i.gonderenUserId ?? null,
    kaynakMesajId: i.kaynakMesajId ?? null,
    hamMesajId: i.hamMesajId ?? null,
    kaynakAd: i.kaynak?.ad ?? null,
  };
}

/**
 * Kayıt akışından çağrılır — GÖNDERMEZ.
 * Bildirim bağımsız cron turunda (bekleyenBildirimleriIsle).
 */
export async function yukIlanlariniBildir(
  ilanlar: KaydedilenIlan[]
): Promise<BildirimSonucu> {
  return {
    telegram: 0,
    push: 0,
    hatalar: [],
    ertelenen: 0,
    atlanan: ilanlar.length,
  };
}

type KuyrukSatir = {
  id: number;
  bildirimDeneme: number;
  bildirimPush: boolean;
  guvenSkoru: number;
  donusTalebiId: number | null;
  gonderenUserId: string | null;
  telefon: string | null;
  kayit: KaydedilenIlan;
};

/**
 * Bağımsız bildirim kuyruğu — cron her 5 dk.
 * - bildirildi=false, deneme < 3, sonGorulme ≤24s, WEB hariç
 * - koridor+araç (ilgiliMi)
 * - gece 23–07: gönderme, biriktir (sabah özeti)
 * - TG fail → bildirildi false; push ayrı bayrak (tekrar push yok)
 * - ikisi de (açıksa) başarılı → bildirildi=true
 */
export async function bekleyenBildirimleriIsle(
  limit = BILDIRIM_TUR_LIMIT
): Promise<BildirimSonucu> {
  const sonuc: BildirimSonucu = {
    telegram: 0,
    push: 0,
    hatalar: [],
    ertelenen: 0,
    atlanan: 0,
    islenen: 0,
    vazgecilen: 0,
  };

  if (bildirimSessizMi()) {
    const bekleyen = await prisma.yukIlani.count({
      where: {
        bildirildi: false,
        bildirimDeneme: { lt: BILDIRIM_MAX_DENEME },
        sonGorulme: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        guvenSkoru: { gte: SUPHE_SINIRI },
        durum: { notIn: ["ARSIV", "ELENDI"] },
        AND: [webKaynakHaricKosulu()],
      },
    });
    sonuc.ertelenen = bekleyen;
    return sonuc;
  }

  const tercih = await aiTercihleriOku();
  const sinir = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const adayLimit = Math.max(1, Math.min(limit, 20)) * 4;

  const ham = await prisma.yukIlani.findMany({
    where: {
      bildirildi: false,
      bildirimDeneme: { lt: BILDIRIM_MAX_DENEME },
      sonGorulme: { gte: sinir },
      guvenSkoru: { gte: SUPHE_SINIRI },
      durum: { notIn: ["ARSIV", "ELENDI"] },
      AND: [webKaynakHaricKosulu()],
    },
    orderBy: [{ guvenSkoru: "desc" }, { sonGorulme: "desc" }],
    take: adayLimit,
    include: { kaynak: { select: { ad: true, tur: true } } },
  });

  const kuyruk: KuyrukSatir[] = [];
  for (const i of ham) {
    const kayit = kaydaDon(i);
    if (!ilgiliMi(kayit, tercih)) {
      sonuc.atlanan += 1;
      continue;
    }
    kuyruk.push({
      id: i.id,
      bildirimDeneme: i.bildirimDeneme,
      bildirimPush: i.bildirimPush,
      guvenSkoru: i.guvenSkoru,
      donusTalebiId: i.donusTalebiId,
      gonderenUserId: i.gonderenUserId,
      telefon: i.telefon,
      kayit,
    });
    if (kuyruk.length >= Math.max(1, Math.min(limit, 20))) break;
  }

  const kok = siteAdresi();
  const tgGerekli =
    tercih.telegramAcik &&
    Boolean(tercih.telegramChatId) &&
    telegramKullanilabilir();
  const pushGerekli = tercih.pushAcik && pushKullanilabilir();

  for (const satir of kuyruk) {
    sonuc.islenen = (sonuc.islenen || 0) + 1;
    const deneme = satir.bildirimDeneme + 1;
    const ilan = satir.kayit;

    const donusMu = Boolean(satir.donusTalebiId);
    const baslik = donusMu ? "Dönüş yükü bulundu" : "Yeni yük bulundu";
    const metinHtml = donusMu
      ? `<b>DÖNÜŞ YÜKÜ</b>\n` + yeniYukMetni(ilan, tercih.maliyet, true)
      : yeniYukMetni(ilan, tercih.maliyet, true);
    const metinDuz = yeniYukMetni(ilan, tercih.maliyet, false);

    let butonSatirlari: Awaited<ReturnType<typeof tdmKartButonlari>> = null;
    if (satir.gonderenUserId || satir.telefon) {
      try {
        butonSatirlari = await tdmKartButonlari({
          id: satir.id,
          gonderenUserId: satir.gonderenUserId,
          telefon: satir.telefon,
        });
      } catch (e) {
        console.warn(
          "[bildirim] tdmKartButonlari",
          e instanceof Error ? e.message : e
        );
      }
    }

    const panelUrl = kok
      ? `${kok}/ai/yukler?sekme=HEPSI&id=${satir.id}`
      : null;
    const panelButon = panelUrl
      ? { metin: "Panelde Aç", url: panelUrl }
      : null;

    let tgOk = !tgGerekli; // TG kapalıysa kanal tamam sayılır
    if (tgGerekli && tercih.telegramChatId) {
      const satir1 = butonSatirlari?.[0] ? [...butonSatirlari[0]] : [];
      if (panelButon) satir1.push(panelButon);
      const butonlar =
        satir1.length > 0
          ? [satir1]
          : panelButon
            ? [[panelButon]]
            : undefined;

      const cevap = await telegramGonder(
        tercih.telegramChatId,
        metinHtml,
        butonlar
      );

      await prisma.bildirim.create({
        data: {
          kanal: "TELEGRAM",
          hedef: tercih.telegramChatId,
          baslik,
          metin: metinDuz.slice(0, 500),
          durum: cevap.basarili ? "GONDERILDI" : "HATA",
          hata: cevap.hata,
        },
      });

      if (cevap.basarili) {
        tgOk = true;
        sonuc.telegram += 1;
      } else {
        tgOk = false;
        if (cevap.hata) sonuc.hatalar.push(cevap.hata);
      }
    }

    let pushOk = satir.bildirimPush || !pushGerekli;
    if (pushGerekli && !satir.bildirimPush) {
      const cevap = await pushGonder({
        baslik,
        metin: metinDuz.slice(0, 180),
        url: `/ai/yukler?sekme=HEPSI&id=${satir.id}`,
      });
      if (cevap.gonderilen > 0) {
        pushOk = true;
        sonuc.push += cevap.gonderilen;
      } else {
        pushOk = false;
        if (cevap.hata) sonuc.hatalar.push(cevap.hata);
      }
    }

    const tamam = tgOk && pushOk;
    const guncelle: {
      bildirimDeneme: number;
      bildirildi?: boolean;
      bildirimPush?: boolean;
    } = { bildirimDeneme: deneme };

    if (pushOk && !satir.bildirimPush && pushGerekli) {
      guncelle.bildirimPush = true;
    }
    if (tamam) {
      guncelle.bildirildi = true;
      if (pushGerekli) guncelle.bildirimPush = true;
    }

    await prisma.yukIlani.update({
      where: { id: satir.id },
      data: guncelle,
    });

    if (!tamam && deneme >= BILDIRIM_MAX_DENEME) {
      sonuc.vazgecilen = (sonuc.vazgecilen || 0) + 1;
      console.warn(
        `[bildirim] vazgeçildi #${satir.id} deneme=${deneme}` +
          ` tg=${tgOk} push=${pushOk}`
      );
    }
  }

  return sonuc;
}

/**
 * Sessiz saatte biriken (bildirilmemiş) ilanların sabah özeti.
 * Cron: 07:05 Europe/Istanbul. WEB hariç.
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
      bildirimDeneme: { lt: BILDIRIM_MAX_DENEME },
      guvenSkoru: { gte: SUPHE_SINIRI },
      sonGorulme: { gte: sinir },
      durum: { in: ["YENI", "ILGILENIYOR"] },
      AND: [webKaynakHaricKosulu()],
    },
    orderBy: [{ guvenSkoru: "desc" }, { sonGorulme: "desc" }],
    take: 25,
    include: { kaynak: { select: { ad: true, tur: true } } },
  });

  if (bekleyen.length === 0) return { adet: 0, gonderildi: false };

  const tercih = await aiTercihleriOku();
  const uygun = bekleyen
    .map(kaydaDon)
    .filter((i) => ilgiliMi(i, tercih));

  if (uygun.length === 0) return { adet: 0, gonderildi: false };

  // Sabah: önce özet, sonra aynı turda tek tek de deneyebilir —
  // özet yeterli; kuyruk 5 dk sonra tek tek de dener. Özet sonrası
  // işaretleme YOK — bekleyenBildirimleriIsle gün içinde tek tek göndersin.
  // Kullanıcı "07:05'te tek özet" istedi → özet gönder + bildirildi=true.

  const kok = siteAdresi();
  const ozetSatirlar = uygun.slice(0, 12).map((i) => {
    const rota = `${i.cikisIl || i.nereden || "?"}→${i.varisIl || i.nereye || "?"}`;
    return `• ${htmlKacis(rota)}${i.firmaAdi ? ` · ${htmlKacis(i.firmaAdi)}` : ""} · %${i.guvenSkoru}`;
  });

  const metin =
    `<b>Sabah özeti</b> — gece biriken ${uygun.length} yük\n\n` +
    ozetSatirlar.join("\n") +
    (uygun.length > 12 ? `\n… +${uygun.length - 12} daha` : "");

  let tgOk = false;
  if (tercih.telegramAcik && tercih.telegramChatId && telegramKullanilabilir()) {
    const cevap = await telegramGonder(
      tercih.telegramChatId,
      metin,
      kok
        ? [{ metin: "Listeye git", url: `${kok}/ai/yukler` }]
        : undefined
    );
    tgOk = cevap.basarili;
  }

  let pushOk = false;
  if (tercih.pushAcik && pushKullanilabilir()) {
    const cevap = await pushGonder({
      baslik: `Sabah: ${uygun.length} yük`,
      metin: ozetSatirlar[0]?.replace(/<[^>]+>/g, "") || "Gece biriken yükler",
      url: "/ai/yukler",
    });
    pushOk = cevap.gonderilen > 0;
  }

  // Özet gittiğinde kuyruğu kapat (çift bildirim olmasın).
  if (tgOk || pushOk) {
    await prisma.yukIlani.updateMany({
      where: { id: { in: uygun.map((i) => i.id) } },
      data: { bildirildi: true, bildirimPush: true },
    });
    return { adet: uygun.length, gonderildi: true };
  }

  return { adet: uygun.length, gonderildi: false };
}

/**
 * Bugün TELEGRAM kanalında HATA olan bildirim sayısı — günde 1 özet.
 * Cron: gunluk-rapor (20:30) çağırır.
 */
export async function bildirimHataOzetiGonder(): Promise<{
  adet: number;
  gonderildi: boolean;
}> {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const gunBas = new Date(
    Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) -
      3 * 60 * 60 * 1000
  );

  const adet = await prisma.bildirim.count({
    where: {
      kanal: "TELEGRAM",
      durum: "HATA",
      createdAt: { gte: gunBas },
    },
  });
  if (adet === 0) return { adet: 0, gonderildi: false };

  const tercih = await aiTercihleriOku();
  if (
    !tercih.telegramAcik ||
    !tercih.telegramChatId ||
    !telegramKullanilabilir()
  ) {
    return { adet, gonderildi: false };
  }

  const cevap = await telegramGonder(
    tercih.telegramChatId,
    `Bugün ${adet} bildirim gönderilemedi`
  );
  return { adet, gonderildi: cevap.basarili };
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
