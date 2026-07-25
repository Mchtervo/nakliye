import { aiJson } from "@/lib/ai/istemci";
import { MODEL_HIZLI } from "@/lib/ai/modeller";
import { FIS_SEMASI, type FisCikti } from "@/lib/ai/semalar";
import { GIDER_KATEGORILERI, gecerliKategoriMi } from "@/lib/sabitler";

const KATEGORI_IPUCLARI = GIDER_KATEGORILERI.filter((k) => !k.eski)
  .map((k) => {
    const ipuclari = k.ipuclari?.length ? ` (${k.ipuclari.join(", ")})` : "";
    return `- ${k.kod}: ${k.ad}${ipuclari}`;
  })
  .join("\n");

const SISTEM = `Sen bir Türk nakliyeci için fiş ve fatura okuyan asistansın.
Görseldeki fişten bilgileri çıkar. Kurallar:
- Tutarları TL cinsinden sayı olarak ver, para birimi simgesi yazma.
- "GENEL TOPLAM" / "TOPLAM" satırı KDV dahil tutardır.
- KDV satırı okunabiliyorsa kdvTutarTl olarak ver, okunamıyorsa null bırak.
- Türkiye'de akaryakıt ve çoğu fişte KDV dahildir; aksi belirtilmedikçe kdvDahilMi true.
- Tarih gün/ay/yıl biçiminde yazılıdır, YYYY-MM-DD'ye çevir.
- Fiş bulanık veya okunamıyorsa okunabildi=false ver ve alanları null bırak; tahmin uydurma.

Gider türleri:
${KATEGORI_IPUCLARI}`;

export type FisOkuma = FisCikti;

/**
 * Fiş görselinden alan çıkarır.
 * @param gorselUrl data: URL veya erişilebilir https URL
 */
export async function fisOku(gorselUrl: string): Promise<FisOkuma> {
  const sonuc = await aiJson<FisCikti>({
    model: MODEL_HIZLI,
    sistem: SISTEM,
    metin:
      "Bu fişi oku ve alanları çıkar. Emin olamadığın alanı null bırak, uydurma.",
    gorseller: [{ url: gorselUrl }],
    semaAdi: "fis_okuma",
    sema: FIS_SEMASI,
    caba: "low",
    maxCikti: 900,
    kaynak: "fisOku",
  });

  if (!gecerliKategoriMi(sonuc.kategori)) {
    return { ...sonuc, kategori: "DIGER" };
  }
  return sonuc;
}
