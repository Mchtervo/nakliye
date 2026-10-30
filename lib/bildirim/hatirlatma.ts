/**
 * Telefona (push) + Telegram'a giden hatırlatmalar:
 * - Tahsil edilmemiş iş: iş tarihinden 7, 14, 21, 30. gün, sonra 15 günde bir.
 * - Okuyucu (WhatsApp/Telegram) koptu: 3 saatte bir tekrar.
 */
import { prisma } from "@/lib/prisma";
import { bilgiBildir } from "@/lib/bildirim/gonder";
import { daemonSorunlari } from "@/lib/kaynaklar/daemonNabiz";
import { tlYaz } from "@/lib/para";

const GUN_MS = 24 * 60 * 60 * 1000;
const ODEME_ANAHTAR = "odeme_hatirlatma_gun";
const ODEME_SAAT = 9;
const DAEMON_TEKRAR_MS = 3 * 60 * 60 * 1000;

/** TR saatiyle YYYY-MM-DD ve saat. */
function trSimdi(): { gun: string; saat: number } {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return { gun: tr.toISOString().slice(0, 10), saat: tr.getUTCHours() };
}

function trGun(d: Date): string {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function gunFarki(eski: string, yeni: string): number {
  return Math.round((Date.parse(yeni) - Date.parse(eski)) / GUN_MS);
}

/** 7, 14, 21, 30, sonra 45, 60, 75… */
export function hatirlatmaGunuMu(gecen: number): boolean {
  if (gecen === 7 || gecen === 14 || gecen === 21 || gecen === 30) return true;
  return gecen > 30 && (gecen - 30) % 15 === 0;
}

async function ayarAl(anahtar: string): Promise<string | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar } });
  return k?.deger ?? null;
}

async function ayarKoy(anahtar: string, deger: string): Promise<void> {
  await prisma.ayar.upsert({
    where: { anahtar },
    update: { deger },
    create: { anahtar, deger },
  });
}

function tarihYaz(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" });
}

export async function odemeHatirlat(): Promise<{ adet: number; atlandi?: string }> {
  const { gun, saat } = trSimdi();
  if (saat < ODEME_SAAT) return { adet: 0, atlandi: "saat erken" };
  if ((await ayarAl(ODEME_ANAHTAR)) === gun) return { adet: 0, atlandi: "bugün gönderildi" };

  const yukler = await prisma.yuk.findMany({
    where: { odemeDurumu: { not: "ODENDI" }, tarih: { lte: new Date(Date.now() - 6 * GUN_MS) } },
    select: {
      id: true,
      tarih: true,
      nereden: true,
      nereye: true,
      toplamTutar: true,
      firma: { select: { ad: true } },
      odemeler: { select: { tutar: true } },
    },
    orderBy: { tarih: "asc" },
  });

  const satirlar: string[] = [];
  let toplam = 0;
  for (const y of yukler) {
    const kalan = y.toplamTutar - y.odemeler.reduce((o, p) => o + p.tutar, 0);
    if (kalan <= 0) continue;
    const gecen = gunFarki(trGun(y.tarih), gun);
    if (!hatirlatmaGunuMu(gecen)) continue;
    toplam += kalan;
    satirlar.push(
      `• ${y.firma.ad}: ${tarihYaz(y.tarih)} tarihli ${y.nereden}→${y.nereye} işinin ${tlYaz(kalan)} ödemesi ${gecen} gündür alınmadı`
    );
  }

  await ayarKoy(ODEME_ANAHTAR, gun);
  if (satirlar.length === 0) return { adet: 0 };

  const baslik =
    satirlar.length === 1 ? "Ödeme alınmadı" : `${satirlar.length} işin ödemesi alınmadı (${tlYaz(toplam)})`;
  await bilgiBildir(
    baslik,
    `${satirlar.join("\n")}\n\nÖdeme geldiyse uygulamada işaretle.`,
    "/yukler"
  );
  return { adet: satirlar.length };
}

const YOLCULUK_ANAHTAR = "yolculuk_sor_son";
const YOLCULUK_ARALIK_MS = 3 * 60 * 60 * 1000;

/**
 * Açık yolculuk yoksa 08–20 arası 3 saatte bir "Yolculuk nereye?".
 * Boşaltma yeri girilince o il ve 90 km çevresindeki yükler bildirilir.
 */
export async function yolculukSor(): Promise<boolean> {
  const { saat } = trSimdi();
  if (saat < 8 || saat >= 20) return false;
  const acik = await prisma.donusTalebi.count({ where: { aktif: true } });
  if (acik > 0) return false;
  const onceki = Number((await ayarAl(YOLCULUK_ANAHTAR)) || 0);
  if (Date.now() - onceki < YOLCULUK_ARALIK_MS) return false;
  await ayarKoy(YOLCULUK_ANAHTAR, String(Date.now()));
  await bilgiBildir(
    "Yolculuk nereye?",
    "Nereden yükledin, nereye boşaltıyorsun? Yaz, vardığın yerde ve 90 km çevresinde dönüş yükü arayayım.",
    "/#yolculuk"
  );
  return true;
}

/** Kopan okuyucu için 3 saatte bir hatırlatma; eşleme kodu da içinde gelir. */
export async function okuyucuHatirlat(): Promise<number> {
  const sorunlar = await daemonSorunlari();
  let gonderilen = 0;
  for (const s of sorunlar) {
    const anahtar = `daemon_uyari_${s.ad}`;
    const onceki = Number((await ayarAl(anahtar)) || 0);
    if (Date.now() - onceki < DAEMON_TEKRAR_MS) continue;
    // Eşleme kodu dakikada bir değişir; bildirimdeki kod bayatlar, ekrandaki güncel.
    const detay = s.detay.startsWith("Kod:") ? "Güncel eşleme kodu yük ekranında." : s.detay;
    await bilgiBildir(s.baslik, detay, "/ai/yukler");
    await ayarKoy(anahtar, String(Date.now()));
    gonderilen += 1;
  }
  // Düzelen okuyucu: bir sonraki kopuşta hemen haber gelsin.
  const sorunlu = sorunlar.map((s) => `daemon_uyari_${s.ad}`);
  await prisma.ayar.deleteMany({
    where: { anahtar: { startsWith: "daemon_uyari_", notIn: sorunlu } },
  });
  return gonderilen;
}
