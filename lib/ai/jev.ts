/**
 * TypeSafe Jev — karar modeli (metin üretmez, olasılık döner).
 * OpenAI'den önce "bu mesajda yük ilanı var mı?" ön elemesi için.
 *
 * Ölçüm (2026-10-23, 80 gerçek ilan + 26 gürültü):
 *   eşik 0.2 → gerçek ilan kaybı 0/80, elenen gürültü 19/26.
 *   En düşük gerçek ilan skoru 0.42. 106 çağrı ≈ $0.002.
 */

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const ZAMAN_ASIMI_MS = 8000;

export const JEV_VARSAYILAN_ESIK = 0.2;

export function jevKullanilabilir(): boolean {
  return Boolean(process.env.JEV_API_KEY) && process.env.JEV_KAPALI !== "true";
}

export function jevEsik(): number {
  const n = Number(process.env.JEV_ESIK);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : JEV_VARSAYILAN_ESIK;
}

const YUK_SORUSU = {
  type: "noul",
  instructions:
    "Bu mesajda en az bir YÜK İLANI var mı? Yük ilanı: bir yük sahibi veya aracı, taşınacak yük için araç/tır/kamyon arıyor (genelde çıkış-varış yeri, ton, araç tipi, fiyat veya telefon içerir).",
  criteria: {
    true: "Taşınacak yük için araç aranıyor (yük var, araç lazım)",
    false:
      "Boş araç/tır sahibi yük arıyor, sohbet, selam, satılık/kiralık, iş ilanı, reklam veya haber",
  },
} as const;

/**
 * 0–1 arası "yük ilanı" olasılığı. Anahtar yoksa, hata veya zaman aşımında
 * null döner — çağıran taraf mesajı elemeden eski akışa bırakmalı.
 */
export async function jevYukIlaniSkoru(metin: string): Promise<number | null> {
  const anahtar = process.env.JEV_API_KEY;
  if (!anahtar || process.env.JEV_KAPALI === "true") return null;

  try {
    const yanit = await fetch(JEV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anahtar}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jev-latest",
        state: metin.slice(0, 3000),
        questions: { yuk: YUK_SORUSU },
      }),
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    });
    if (!yanit.ok) {
      console.error("[jev] HTTP", yanit.status);
      return null;
    }
    const veri = (await yanit.json()) as {
      answers?: { yuk?: { noul?: number } };
    };
    const skor = veri.answers?.yuk?.noul;
    return typeof skor === "number" ? skor : null;
  } catch (hata) {
    console.error("[jev]", hata instanceof Error ? hata.message : "istek başarısız");
    return null;
  }
}
