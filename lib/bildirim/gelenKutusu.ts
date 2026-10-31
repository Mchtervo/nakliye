/**
 * Uygulama içi bildirim kutusu (üst bardaki zil). pushGonder her bildirimi
 * buraya da yazar; push kapalı/izinsiz cihazda da okunabilsin.
 */
import { prisma } from "@/lib/prisma";

export type BildirimButonu = { etiket: string; url: string };

const SAKLA_MS = 30 * 24 * 60 * 60 * 1000;

/** Düğme verilmemişse hedef adrese göre tek düğme; ana sayfa/boşsa düğme yok. */
export function varsayilanButonlar(url: string | null | undefined): BildirimButonu[] {
  if (!url || url === "/") return [];
  if (url.startsWith("/?guncelle")) return [{ etiket: "Şimdi güncelle", url }];
  if (url.startsWith("/ana-ekran")) return [{ etiket: "Simgeyi yenile", url }];
  if (url.includes("#yolculuk")) return [{ etiket: "Yolculuğa git", url }];
  if (url.includes("#km")) return [{ etiket: "Kilometreye git", url }];
  if (url.includes("#belgeler")) return [{ etiket: "Belgelere git", url }];
  if (url.startsWith("/ai/yukler")) return [{ etiket: "İlanı aç", url }];
  if (url.startsWith("/ayarlar")) return [{ etiket: "Ayarlara git", url }];
  if (url.startsWith("/yukler")) return [{ etiket: "Seferlere git", url }];
  return [{ etiket: "Aç", url }];
}

export async function gelenKutusunaEkle(b: {
  baslik: string;
  metin: string;
  url?: string | null;
  butonlar?: BildirimButonu[];
}): Promise<void> {
  try {
    await prisma.uygulamaBildirimi.create({
      data: {
        baslik: b.baslik.slice(0, 200),
        metin: b.metin.slice(0, 4000),
        url: b.url ?? null,
        butonlar: b.butonlar ?? varsayilanButonlar(b.url),
      },
    });
  } catch (e) {
    // Kutuya yazılamaması telefon bildirimini engellemesin
    console.warn("[gelenKutusu]", e instanceof Error ? e.message : e);
  }
}

export async function gelenKutusu(adet = 40) {
  await prisma.uygulamaBildirimi
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - SAKLA_MS) } } })
    .catch(() => null);
  const [liste, okunmamis] = await Promise.all([
    prisma.uygulamaBildirimi.findMany({ orderBy: { id: "desc" }, take: adet }),
    prisma.uygulamaBildirimi.count({ where: { okundu: null } }),
  ]);
  return { liste, okunmamis };
}

/** id verilirse o bildirim, yoksa hepsi okundu. */
export async function okunduYap(id?: number): Promise<void> {
  await prisma.uygulamaBildirimi.updateMany({
    where: { okundu: null, ...(id ? { id } : {}) },
    data: { okundu: new Date() },
  });
}
