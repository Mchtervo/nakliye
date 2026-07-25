import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let ayarlandi = false;

export function pushKullanilabilir(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY
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

export type PushIcerik = {
  baslik: string;
  metin: string;
  url?: string;
};

export type PushSonuc = { gonderilen: number; hata: string | null };

export async function pushGonder(icerik: PushIcerik): Promise<PushSonuc> {
  if (!vapidAyarla()) {
    return { gonderilen: 0, hata: "VAPID anahtarları tanımlı değil." };
  }

  const aboneler = await prisma.pushAbone.findMany();
  if (aboneler.length === 0) return { gonderilen: 0, hata: null };

  const govde = JSON.stringify({
    baslik: icerik.baslik,
    metin: icerik.metin,
    url: icerik.url || "/ai/yukler",
  });

  let gonderilen = 0;
  const olulerIdler: number[] = [];

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
        // 404/410: abonelik iptal edilmiş, temizle.
        if (kod === 404 || kod === 410) olulerIdler.push(abone.id);
      }
    })
  );

  if (olulerIdler.length > 0) {
    await prisma.pushAbone.deleteMany({ where: { id: { in: olulerIdler } } });
  }

  return { gonderilen, hata: null };
}
