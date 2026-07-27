/**
 * İlana özel iletişim mesajı — taahhüt yok, sadece eksik bilgi sorusu.
 * Şablon Ayarlar'dan; AI yok (ton kontrolü + maliyet).
 */
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { fiyatGorunumu } from "@/lib/ilanGorunum";
import { whatsappMesajUrl } from "@/lib/whatsapp";

const CACHE_MS = 24 * 60 * 60 * 1000;

/** Varsayılan nötr şablon — taahhüt / araç / müsaitlik YOK. */
export const VARSAYILAN_MESAJ_SABLON =
  "Merhaba, {rota} işiniz için bilgi alabilir miyim?\nKaç ton, navlun ne kadar, yükleme ne zaman ve tam adres neresi?";

export type WaSablon = {
  ad: string;
  firma: string;
  arac: string;
  tonaj: string;
  musaitlik: string;
  tonTercih: string;
  imza: string;
  /** {rota} {sorular} yer tutuculu metin */
  mesajSablon: string;
};

export async function waSablonOku(): Promise<WaSablon> {
  const [ad, firma, arac, tonaj, musaitlik, tonTercih, imza, mesajSablon] =
    await Promise.all([
      ayarOku(AYAR_ANAHTARLARI.waSablonAd),
      ayarOku(AYAR_ANAHTARLARI.waSablonFirma),
      ayarOku(AYAR_ANAHTARLARI.waSablonArac),
      ayarOku(AYAR_ANAHTARLARI.waSablonTonaj),
      ayarOku(AYAR_ANAHTARLARI.waSablonMusaitlik),
      ayarOku(AYAR_ANAHTARLARI.waSablonTonTercih),
      ayarOku(AYAR_ANAHTARLARI.waSablonImza),
      ayarOku(AYAR_ANAHTARLARI.waMesajSablon),
    ]);

  return {
    ad: ad || "",
    firma: firma || "",
    arac: arac || "",
    tonaj: tonaj || "",
    musaitlik: musaitlik || "",
    tonTercih: tonTercih || "",
    imza: imza || "",
    mesajSablon: (mesajSablon || "").trim() || VARSAYILAN_MESAJ_SABLON,
  };
}

function cacheAnahtar(ilanId: number): string {
  return `ilan_wa_v3:${ilanId}`;
}

type CacheKayit = { metin: string; zaman: string };

async function cacheOku(ilanId: number): Promise<string | null> {
  const kayit = await prisma.ayar.findUnique({
    where: { anahtar: cacheAnahtar(ilanId) },
  });
  if (!kayit?.deger) return null;
  try {
    const j = JSON.parse(kayit.deger) as CacheKayit;
    if (!j.metin || !j.zaman) return null;
    if (Date.now() - Date.parse(j.zaman) > CACHE_MS) return null;
    return j.metin;
  } catch {
    return null;
  }
}

async function cacheYaz(ilanId: number, metin: string): Promise<void> {
  const deger = JSON.stringify({
    metin,
    zaman: new Date().toISOString(),
  } satisfies CacheKayit);
  await prisma.ayar.upsert({
    where: { anahtar: cacheAnahtar(ilanId) },
    create: { anahtar: cacheAnahtar(ilanId), deger },
    update: { deger },
  });
}

/** Sadece ilanda olmayanları sor. */
export function eksikSorulariUret(ilan: {
  tonaj: number | null;
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz?: boolean;
  yuklemeTarihi: Date | null;
}): string[] {
  const fiyat = fiyatGorunumu(ilan);
  const sorular: string[] = [];
  if (!ilan.tonaj) sorular.push("kaç ton");
  if (!fiyat.ana) sorular.push("navlun ne kadar");
  if (!ilan.yuklemeTarihi) sorular.push("yükleme ne zaman");
  sorular.push("tam adres neresi");
  sorular.push("ödeme peşin mi vadeli mi");
  return sorular;
}

function sorulariCumle(sorular: string[]): string {
  if (sorular.length === 0) {
    return "Hâlâ güncel mi, kısa bilgi verir misiniz?";
  }
  if (sorular.length === 1) {
    return `${sorular[0][0].toUpperCase()}${sorular[0].slice(1)}?`;
  }
  const son = sorular[sorular.length - 1];
  const once = sorular.slice(0, -1);
  const metin = `${once.join(", ")} ve ${son}?`;
  return metin.charAt(0).toUpperCase() + metin.slice(1);
}

/**
 * Şablondan mesaj üret. Taahhüt / araç / müsaitlik eklenmez.
 * Yer tutucular: {rota} {sorular} (sorular opsiyonel)
 */
export function mesajSablondanUret(
  sablon: string,
  rota: string,
  sorular: string[]
): string {
  const ham = (sablon || VARSAYILAN_MESAJ_SABLON)
    .replaceAll("{rota}", rota)
    .replaceAll("{sorular}", sorulariCumle(sorular))
    .trim();

  // Güvenlik: taahhüt kalıplarını budama (eski şablon kalıntısı)
  const yasak =
    /\b(müsaitim|musaitim|taşıyabilirim|tasiyabilirim|alırım|alirim|yaparım|yaparim|komple yük taşı|ilgileniyorum)\b/i;
  return (
    ham
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && !yasak.test(s))
      .join("\n")
      .trim() ||
    `Merhaba, ${rota} işiniz için bilgi alabilir miyim?\nKaç ton, navlun ne kadar, yükleme ne zaman ve tam adres neresi?`
  );
}

/** Ortak mesaj üretimi — telefon zorunlu değil. */
export async function ilanIletisimMesaji(
  ilanId: number,
  secenek: { zorlaYenile?: boolean } = {}
): Promise<{ metin: string; cache: boolean; waUrl: string | null }> {
  const ilan = await prisma.yukIlani.findUnique({ where: { id: ilanId } });
  if (!ilan) throw new Error("İlan bulunamadı.");

  if (!secenek.zorlaYenile) {
    const cached = await cacheOku(ilanId);
    if (cached) {
      return {
        metin: cached,
        cache: true,
        waUrl: whatsappMesajUrl(ilan.telefon, cached),
      };
    }
  }

  const sablon = await waSablonOku();
  const rota = `${ilan.nereden || ilan.cikisIl || "?"}→${ilan.nereye || ilan.varisIl || "?"}`;
  // Sabit bilgi sorusu — taahhüt / ödeme / araç yok
  const sabitSorular = [
    "kaç ton",
    "navlun ne kadar",
    "yükleme ne zaman",
    "tam adres neresi",
  ];
  const temiz = mesajSablondanUret(sablon.mesajSablon, rota, sabitSorular);


  // İmza isteğe bağlı — sadece ayarda doluysa ve taahhüt değilse
  const imza = sablon.imza.trim();
  const metin =
    imza && !/\b(müsait|taşı|alır|yapar)\b/i.test(imza)
      ? `${temiz}\n${imza}`
      : temiz;

  await cacheYaz(ilanId, metin);

  return {
    metin,
    cache: false,
    waUrl: whatsappMesajUrl(ilan.telefon, metin),
  };
}

/** WhatsApp butonu için — telefon şart. */
export async function ilanWhatsappMesaji(
  ilanId: number,
  secenek: { zorlaYenile?: boolean } = {}
): Promise<{ metin: string; cache: boolean; waUrl: string | null }> {
  const ilan = await prisma.yukIlani.findUnique({
    where: { id: ilanId },
    select: { telefon: true },
  });
  if (!ilan) throw new Error("İlan bulunamadı.");
  if (!ilan.telefon) throw new Error("Telefonsuz ilanda mesaj yok.");
  return ilanIletisimMesaji(ilanId, secenek);
}
