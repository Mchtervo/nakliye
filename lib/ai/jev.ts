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

/** Koridor sorusu eşiği. Ölçüm (31.10, 497 gerçek mesaj): 0.1'de koridor içi
 *  ilan kaybı 0; elenen ilansız mesaj %21. Bu eşiğin altında kalan "ilanlar"
 *  varışı yurt dışı / doğu olup varışsız kaydedilenlerdi (Moskova, Irak, Malatya). */
export const JEV_KORIDOR_ESIK = 0.1;

/**
 * 0–1: mesajda çıkışı VE varışı koridor illerinde olan en az bir yük var mı?
 * Hata / anahtar yoksa null (çağıran elemez).
 */
export async function jevKoridorSkoru(metin: string, iller: string[]): Promise<number | null> {
  const anahtar = process.env.JEV_API_KEY;
  if (!anahtar || process.env.JEV_KAPALI === "true" || iller.length === 0) return null;
  try {
    const yanit = await fetch(JEV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${anahtar}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: metin.slice(0, 3000),
        questions: {
          koridor: {
            type: "noul",
            instructions: `Bu mesajda, yükleme (çıkış) yeri VE boşaltma (varış) yeri İKİSİ DE şu illerden birinde (ilçe/semt adıyla yazılmış olabilir) olan en az bir yük ilanı var mı? İller: ${iller.join(", ")}. İstanbul'da yalnız Anadolu yakası sayılır.`,
            criteria: {
              true: "En az bir yükün hem çıkışı hem varışı listedeki illerde",
              false:
                "Hiçbir yükün iki ucu birden listede değil (biri doğu, güneydoğu, Karadeniz, Trakya, Avrupa yakası vb.) ya da yük yok",
            },
          },
        },
      }),
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    });
    if (!yanit.ok) return null;
    const veri = (await yanit.json()) as { answers?: { koridor?: { noul?: number } } };
    const skor = veri.answers?.koridor?.noul;
    return typeof skor === "number" ? skor : null;
  } catch {
    return null;
  }
}
