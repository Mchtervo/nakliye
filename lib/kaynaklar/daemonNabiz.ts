/**
 * Okuyucu daemon'ların (WhatsApp, Telegram) bağlantı nabzı.
 * Daemon dakikada bir yazar; yük ekranı okur. Telegram botu engelli
 * olsa bile kopukluk panelde görünür.
 */
import { prisma } from "@/lib/prisma";

export type DaemonAdi = "whatsapp" | "telegram";
export type NabizDurum = "BAGLI" | "KOPTU" | "OTURUM_KAPANDI" | "ESLEME_BEKLIYOR";

export type Nabiz = { durum: NabizDurum; zaman: string; not?: string };

/** Bu süredir nabız yoksa daemon ölü sayılır (servis durmuş / çökmüş). */
const OLU_ESIK_MS = 10 * 60 * 1000;

const anahtar = (ad: DaemonAdi) => `daemon_nabiz_${ad}`;

export async function nabizYaz(ad: DaemonAdi, durum: NabizDurum, not?: string): Promise<void> {
  const deger = JSON.stringify({ durum, zaman: new Date().toISOString(), ...(not ? { not } : {}) });
  await prisma.ayar
    .upsert({
      where: { anahtar: anahtar(ad) },
      update: { deger },
      create: { anahtar: anahtar(ad), deger },
    })
    .catch(() => null);
}

export type DaemonSorunu = { ad: DaemonAdi; baslik: string; detay: string };

const AD: Record<DaemonAdi, string> = { whatsapp: "WhatsApp", telegram: "Telegram" };

function dakikaOnce(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000);
}

/** Sorunlu daemon'lar. Hiç nabız yazmamış (eski sürüm) olan gösterilmez. */
export async function daemonSorunlari(): Promise<DaemonSorunu[]> {
  const satirlar = await prisma.ayar.findMany({
    where: { anahtar: { in: [anahtar("whatsapp"), anahtar("telegram")] } },
  });
  const cikti: DaemonSorunu[] = [];
  for (const s of satirlar) {
    const ad = s.anahtar.replace("daemon_nabiz_", "") as DaemonAdi;
    let n: Nabiz;
    try {
      n = JSON.parse(s.deger) as Nabiz;
    } catch {
      continue;
    }
    const dk = dakikaOnce(n.zaman);
    if (Date.now() - new Date(n.zaman).getTime() > OLU_ESIK_MS) {
      cikti.push({
        ad,
        baslik: `${AD[ad]} okuyucu durmuş`,
        detay: `${dk} dakikadır ses yok. Sunucuda: sudo systemctl restart yukavci-${ad}`,
      });
      continue;
    }
    if (n.durum === "BAGLI") continue;
    const baslik =
      n.durum === "ESLEME_BEKLIYOR"
        ? `${AD[ad]} eşleme bekliyor`
        : n.durum === "OTURUM_KAPANDI"
          ? `${AD[ad]} oturumu kapandı`
          : `${AD[ad]} bağlantısı koptu`;
    cikti.push({ ad, baslik, detay: n.not || `${dk} dk önce` });
  }
  return cikti;
}
