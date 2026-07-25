/**
 * Model seçimleri tek yerde tutulur; OpenAI model adı değişirse
 * sadece burası (veya env değişkenleri) güncellenir.
 */

/** Yüksek hacimli, ucuz işler: ilan çözümleme, fiş OCR. */
export const MODEL_HIZLI = process.env.OPENAI_MODEL_HIZLI || "gpt-5.6-luna";

/** Muhakeme isteyen işler: günlük analiz, firma bulma. */
export const MODEL_ANALIZ = process.env.OPENAI_MODEL_ANALIZ || "gpt-5.6-terra";

export const AI_ZAMAN_ASIMI_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
