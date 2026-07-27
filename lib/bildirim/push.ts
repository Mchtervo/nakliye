import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let ayarlandi = false;

export function pushKullanilabilir(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

export function pushAcikAnahtar(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function vapidAyarla(): boolean {
  if (ayarlandi) return true;
  if (!pushKullanilabilir()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:bildirim@nakliyedefteri.app",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  ayarlandi = true;
  return true;
}

function siteKok(): string {
  return (
    process.env.SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    ""
  ).replace(/\/$/, "");
}

/** Göreli yolu mutlak URL'ye çevir (bildirim tıklaması için). */
export function pushUrlMutlak(yol?: string): string {
  const yolTemiz = yol?.trim() || "/ai/yukler";
  if (/^https?:\/\//i.test(yolTemiz)) return yolTemiz;
  const kok = siteKok();
  const yolSlash = yolTemiz.startsWith("/") ? yolTemiz : `/${yolTemiz}`;
  return kok ? `${kok}${yolSlash}` : yolSlash;
}

export type PushIcerik = {
  baslik: string;
  metin: string;
  url?: string;
};

export type PushSonuc = {
  gonderilen: number;
  abone: number;
  hata: string | null;
};

export async function pushGonder(icerik: PushIcerik): Promise<PushSonuc> {
  if (!vapidAyarla()) {
    return {
      gonderilen: 0,
      abone: 0,
      hata: "VAPID anahtarları tanımlı değil (npm run push:kur).",
    };
  }

  const aboneler = await prisma.pushAbone.findMany();
  if (aboneler.length === 0) {
    return {
      gonderilen: 0,
      abone: 0,
      hata: "Kayıtlı cihaz yok — Ayarlar → Bu cihazda bildirimi aç.",
    };
  }

  const url = pushUrlMutlak(icerik.url);
  const govde = JSON.stringify({
    baslik: icerik.baslik,
    metin: icerik.metin,
    url,
  });

  let gonderilen = 0;
  const olulerIdler: number[] = [];
  let sonHata: string | null = null;

  await Promise.all(
    aboneler.map(async (abone) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: abone.endpoint,
            keys: { p256dh: abone.p256dh, auth: abone.auth },
          },
          govde
        );
        gonderilen += 1;
      } catch (hata) {
        const kod = (hata as { statusCode?: number })?.statusCode;
        const mesaj =
          hata instanceof Error ? hata.message : String(hata);
        if (kod === 404 || kod === 410) olulerIdler.push(abone.id);
        else sonHata = mesaj.slice(0, 200);
      }
    })
  );

  if (olulerIdler.length > 0) {
    await prisma.pushAbone.deleteMany({ where: { id: { in: olulerIdler } } });
  }

  await prisma.bildirim.create({
    data: {
      kanal: "PUSH",
      hedef: `${aboneler.length} cihaz`,
      baslik: icerik.baslik,
      metin: icerik.metin.slice(0, 500),
      durum: gonderilen > 0 ? "GONDERILDI" : "HATA",
      hata: gonderilen > 0 ? null : sonHata || "Hiçbir cihaza ulaşılamadı",
    },
  });

  return {
    gonderilen,
    abone: aboneler.length - olulerIdler.length,
    hata: gonderilen > 0 ? null : sonHata || "Hiçbir cihaza ulaşılamadı",
  };
}
