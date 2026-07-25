import { ilanlariCozumle } from "@/lib/ai/ilanCozumle";
import { bosSonuc, type KaynakAdaptoru, type TaramaSonucu } from "@/lib/kaynaklar/tip";

const MAX_METIN = 14000;
const ISTEK_ZAMAN_ASIMI = 12000;

/** HTML'i AI'ye verilecek düz metne indirger (bağımlılık eklemeden). */
export function htmlMetneCevir(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export const webAdaptoru: KaynakAdaptoru = {
  tur: "WEB",
  async tara(kaynak): Promise<TaramaSonucu> {
    let url: URL;
    try {
      url = new URL(kaynak.hedef);
    } catch {
      return bosSonuc("Geçersiz URL.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return bosSonuc("Sadece http/https adresleri taranabilir.");
    }

    let html: string;
    try {
      const cevap = await fetch(url, {
        headers: {
          // Bazı siteler user-agent olmadan boş sayfa döner.
          "User-Agent":
            "Mozilla/5.0 (compatible; NakliyeDefteri/1.0; +https://github.com/Mchtervo/nakliye)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "tr-TR,tr;q=0.9",
        },
        signal: AbortSignal.timeout(ISTEK_ZAMAN_ASIMI),
        cache: "no-store",
      });

      if (!cevap.ok) return bosSonuc(`Site ${cevap.status} döndü.`);
      html = await cevap.text();
    } catch (hata) {
      const mesaj = hata instanceof Error ? hata.message : "bilinmeyen hata";
      return bosSonuc(`Sayfa alınamadı: ${mesaj}`);
    }

    const metin = htmlMetneCevir(html).slice(0, MAX_METIN);
    if (metin.length < 80) return bosSonuc("Sayfada okunabilir içerik yok.");

    try {
      const ilanlar = await ilanlariCozumle(metin);
      return {
        bulunanlar: ilanlar.map((ilan) => ({
          ilan,
          hamMetin: ilanOzeti(ilan, kaynak.ad),
        })),
        hata: null,
      };
    } catch (hata) {
      return bosSonuc(
        hata instanceof Error ? hata.message : "İlanlar çözümlenemedi."
      );
    }
  },
};

/**
 * Web/AI kaynaklarında tek tek ilan metni olmadığı için
 * çözümlenmiş alanlardan okunabilir bir özet üretilir.
 */
export function ilanOzeti(
  ilan: {
    nereden: string | null;
    nereye: string | null;
    firmaAdi: string | null;
    telefon: string | null;
    ucret: number | null;
    yukTipi: string | null;
    aracTipi: string | null;
  },
  kaynakAdi: string
): string {
  const parcalar = [
    `${ilan.nereden ?? "?"} → ${ilan.nereye ?? "?"}`,
    ilan.yukTipi,
    ilan.aracTipi,
    ilan.firmaAdi,
    ilan.telefon,
    ilan.ucret ? `${(ilan.ucret / 100).toLocaleString("tr-TR")} TL` : null,
    `(${kaynakAdi})`,
  ].filter(Boolean);
  return parcalar.join(" · ");
}
