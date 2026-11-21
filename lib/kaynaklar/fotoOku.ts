/**
 * Yazısız fotoğraf ilanları (ekran görüntüsü, kâğıt) → metin.
 * EVREN OCR (dots-ocr, ücretsiz); olmazsa EVREN qwen3-vl-30b.
 * Kapatmak: FOTO_OKU=0. Günlük tavan: FOTO_GUNLUK_LIMIT (varsayılan 600).
 */
const EVREN_KOK = "https://evren-llmapi.ssyz.org.tr/v1";
const ZAMAN_ASIMI_MS = 30_000;
/** Bundan büyük fotoğraf indirilmez (ilan görseli genelde 50–400 KB). */
export const FOTO_MAX_BAYT = 4 * 1024 * 1024;

let gun = "";
let adet = 0;
let ardisikHata = 0;
let duraklatBitis = 0;

function bugun(): string {
  return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
}

/** Fotoğraf okuma açık ve bugünkü tavan dolmadı mı? */
export function fotoOkunabilir(): boolean {
  if (process.env.FOTO_OKU === "0" || !process.env.EVREN_API_KEY) return false;
  if (Date.now() < duraklatBitis) return false;
  if (gun !== bugun()) {
    gun = bugun();
    adet = 0;
  }
  const tavan = Number(process.env.FOTO_GUNLUK_LIMIT) || 600;
  return adet < tavan;
}

export function fotoSayac(): { gun: string; adet: number } {
  return { gun, adet };
}

async function evren(yol: string, govde: unknown): Promise<unknown> {
  const r = await fetch(`${EVREN_KOK}/${yol}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.EVREN_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(govde),
    signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
  });
  if (!r.ok) throw new Error(`EVREN ${yol} ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

/** Fotoğraftaki yazı; okunamazsa / yazı yoksa null. */
export async function fotoMetni(foto: Buffer, mime = "image/jpeg"): Promise<string | null> {
  if (!fotoOkunabilir()) return null;
  adet += 1;
  const url = `data:${mime};base64,${foto.toString("base64")}`;
  let metin: string | null = null;
  try {
    const j = (await evren("ocr", { model: "dots-ocr", image: url })) as { text?: string };
    metin = j.text ?? null;
  } catch {
    try {
      const j = (await evren("chat/completions", {
        model: "qwen3-vl-30b",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Görseldeki yazıyı aynen, satır satır yaz. Yazı yoksa boş bırak." },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
      })) as { choices?: { message?: { content?: string | null } }[] };
      metin = j.choices?.[0]?.message?.content ?? null;
    } catch (e) {
      // Son yedek: NVIDIA görsel modeli
      try {
        const { nvidiaGorselMetni } = await import("@/lib/ai/nvidia");
        metin = await nvidiaGorselMetni(url);
      } catch {
        metin = null;
      }
      if (metin) {
        ardisikHata = 0;
        const temiz = metin.replace(/\n{2,}/g, "\n").trim();
        return temiz.length >= 10 ? temiz : null;
      }
      ardisikHata += 1;
      // Servis düştüyse 10 dk dinlen (her fotoğrafta 60 sn beklemeyelim)
      if (ardisikHata >= 3) {
        duraklatBitis = Date.now() + 10 * 60 * 1000;
        ardisikHata = 0;
      }
      throw e;
    }
  }
  ardisikHata = 0;
  const temiz = (metin ?? "").replace(/\n{2,}/g, "\n").trim();
  return temiz.length >= 10 ? temiz : null;
}
