/**
 * İlana özel iletişim mesajı (WhatsApp / Telegram DM).
 * Cache 24s. Telefon şart değil (DM için).
 */
import { aiMetin } from "@/lib/ai/istemci";
import { MODEL_HIZLI } from "@/lib/ai/modeller";
import { prisma } from "@/lib/prisma";
import { aiTercihleriOku, AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { fiyatGorunumu } from "@/lib/ilanGorunum";
import { guvenliKirp } from "@/lib/metin";
import { whatsappMesajUrl } from "@/lib/whatsapp";

const CACHE_MS = 24 * 60 * 60 * 1000;

export type WaSablon = {
  ad: string;
  firma: string;
  arac: string;
  tonaj: string;
  musaitlik: string;
  tonTercih: string;
  imza: string;
};

export async function waSablonOku(): Promise<WaSablon> {
  const tercih = await aiTercihleriOku();
  const [ad, firma, arac, tonaj, musaitlik, tonTercih, imza] =
    await Promise.all([
      ayarOku(AYAR_ANAHTARLARI.waSablonAd),
      ayarOku(AYAR_ANAHTARLARI.waSablonFirma),
      ayarOku(AYAR_ANAHTARLARI.waSablonArac),
      ayarOku(AYAR_ANAHTARLARI.waSablonTonaj),
      ayarOku(AYAR_ANAHTARLARI.waSablonMusaitlik),
      ayarOku(AYAR_ANAHTARLARI.waSablonTonTercih),
      ayarOku(AYAR_ANAHTARLARI.waSablonImza),
    ]);

  const aracVarsayilan = tercih.aracTipleri.includes("TENTELI")
    ? "tenteli TIR"
    : tercih.aracTipleri[0] || "tenteli TIR";

  return {
    ad: ad || "",
    firma: firma || "",
    arac: arac || aracVarsayilan,
    tonaj: tonaj || (tercih.maxTonaj ? String(tercih.maxTonaj) : "24"),
    musaitlik: musaitlik || "Ankara merkezliyim, müsaitim",
    tonTercih: tonTercih || "komple tercih ederim",
    imza: imza || "",
  };
}

function cacheAnahtar(ilanId: number): string {
  return `ilan_wa:${ilanId}`;
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
  const rota = `${ilan.nereden || ilan.cikisIl || "?"} → ${ilan.nereye || ilan.varisIl || "?"}`;
  const fiyat = fiyatGorunumu(ilan);
  const bilinen = [
    `Güzergah: ${rota}`,
    ilan.tonaj ? `İlan tonajı: ${ilan.tonaj} ton` : null,
    fiyat.ana ? `İlan fiyatı: ${fiyat.ana}` : null,
    ilan.yukTipi ? `Yük: ${ilan.yukTipi}` : null,
    ilan.aracTipi ? `İlan araç: ${ilan.aracTipi}` : null,
    ilan.yuklemeTarihi
      ? `Yükleme tarihi: ${ilan.yuklemeTarihi.toLocaleDateString("tr-TR")}`
      : null,
    ilan.firmaAdi ? `Firma: ${ilan.firmaAdi}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const eksikSorular = [
    !ilan.tonaj ? "net tonaj" : null,
    "tam yükleme adresi",
    !ilan.yuklemeTarihi ? "yükleme tarihi/saati" : null,
    "komple mi parsiyel mi",
    !fiyat.ana ? "navlun ne kadar" : null,
    "ödeme peşin mi vadeli mi",
    "boşaltma yeri neresi",
  ].filter(Boolean);

  const metin = await aiMetin({
    model: MODEL_HIZLI,
    sistem: `Sen Türk şoför/esnaf dilinde WhatsApp/Telegram mesajı yazan asistansın.
Kurallar:
- 4-5 cümle, samimi ama profesyonel.
- Bilinen bilgiyi tekrar SORMA.
- Eksik olanları sor.
- Sadece mesaj metnini yaz; tırnak/başlık/markdown yok.
- Türkçe, kopyala-yapıştır düz metin.`,
    metin: guvenliKirp(
      `İLAN BİLGİLERİ:\n${bilinen}\n\n` +
        `BENİM BİLGİLERİM:\n` +
        `- Ad: ${sablon.ad || "(yok)"}\n` +
        `- Firma: ${sablon.firma || "(yok)"}\n` +
        `- Araç: ${sablon.arac}, ${sablon.tonaj} ton\n` +
        `- Durum: ${sablon.musaitlik}\n` +
        `- Tercih: ${sablon.tonTercih}\n` +
        `- İmza: ${sablon.imza || "(yok)"}\n\n` +
        `SORULACAKLAR (bilineni atla): ${eksikSorular.join(", ")}\n\n` +
        `Bu ilan için kısa bir mesaj yaz.`,
      4000
    ),
    caba: "none",
    maxCikti: 400,
    kaynak: `wa.mesaj.${ilanId}`,
  });

  const temiz = metin.trim().replace(/^["«]|["»]$/g, "");
  await cacheYaz(ilanId, temiz);

  return {
    metin: temiz,
    cache: false,
    waUrl: whatsappMesajUrl(ilan.telefon, temiz),
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
