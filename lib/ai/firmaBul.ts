import { prisma } from "@/lib/prisma";
import { aiJson } from "@/lib/ai/istemci";
import { MODEL_ANALIZ } from "@/lib/ai/modeller";
import { ADAY_FIRMA_SEMASI, type AdayFirmaCikti } from "@/lib/ai/semalar";

const SISTEM = `Sen bir Türk nakliyeciye yeni müşteri bulan araştırma asistanısın.
Web arama aracını kullanarak verilen şehirdeki gerçek firmaları bul.

Öncelik sırası:
1. Organize sanayi bölgelerindeki (OSB) üretim tesisleri ve fabrikalar
2. Toptancılar, depolar, lojistik ve dağıtım firmaları
3. İnşaat malzemesi, gıda, tekstil, metal gibi düzenli yük çıkaran işletmeler

Kurallar:
- Sadece gerçekten var olan, adı ve iletişim bilgisi doğrulanabilen firmaları ver.
- Telefonu bulabilirsen sabit veya GSM olarak yaz; bulamazsan null bırak.
- Nakliye ihtiyacı olmayan işletmeleri (kuaför, kafe, market şubesi) ekleme.
- skor: düzenli tır yükü çıkarma ihtimaline göre 0-100.
- En fazla 12 firma döndür.`;

/**
 * Şehir (ve varsa sektör) için aday firmaları arar ve kaydeder.
 * Zaten kayıtlı firmalar atlanır; eklenen sayısını döndürür.
 */
export async function adayFirmalariBul(
  sehir: string,
  sektor: string | null
): Promise<number> {
  const cikti = await aiJson<AdayFirmaCikti>({
    model: MODEL_ANALIZ,
    sistem: SISTEM,
    metin: sektor
      ? `${sehir} ilinde ${sektor} alanında faaliyet gösteren, nakliye ihtiyacı olabilecek firmaları bul.`
      : `${sehir} ilindeki OSB'lerde ve sanayi bölgelerinde nakliye ihtiyacı olabilecek üretici firmaları bul.`,
    semaAdi: "aday_firmalar",
    sema: ADAY_FIRMA_SEMASI,
    caba: "medium",
    webArama: true,
    maxCikti: 4000,
    zamanAsimiMs: 120000,
  });

  const kaynak = sektor ? `${sehir} · ${sektor}` : sehir;
  let eklenen = 0;

  for (const firma of cikti.firmalar || []) {
    const ad = firma.ad?.trim();
    if (!ad || ad.length < 2) continue;

    const firmaSehri = firma.sehir?.trim() || sehir;

    const mevcut = await prisma.adayFirma.findFirst({
      where: { ad, sehir: firmaSehri },
      select: { id: true },
    });
    if (mevcut) continue;

    // Zaten müşterisiyse aday listesine düşmesin.
    const cari = await prisma.firma.findUnique({ where: { ad } });
    if (cari) continue;

    try {
      await prisma.adayFirma.create({
        data: {
          ad,
          sehir: firmaSehri,
          ilce: firma.ilce?.trim() || null,
          adres: firma.adres?.trim() || null,
          telefon: firma.telefon?.replace(/[^\d+]/g, "") || null,
          web: firma.web?.trim() || null,
          sektor: firma.sektor?.trim() || sektor,
          neden: firma.neden?.trim() || null,
          kaynak,
          skor: Math.max(0, Math.min(100, Math.round(firma.skor ?? 0))),
        },
      });
      eklenen += 1;
    } catch {
      continue;
    }
  }

  return eklenen;
}
