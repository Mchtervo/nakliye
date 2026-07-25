/**
 * Model seçimleri tek yerde tutulur; OpenAI model adı değişirse
 * sadece burası (veya env değişkenleri) güncellenir.
 */

/** Yüksek hacimli işler: ilan çözümleme, fiş OCR. */
export const MODEL_HIZLI = process.env.OPENAI_MODEL_HIZLI || "gpt-5.6-luna";

/** Muhakeme isteyen işler: günlük analiz, firma bulma. */
export const MODEL_ANALIZ = process.env.OPENAI_MODEL_ANALIZ || "gpt-5.6-terra";

/** İstek zaman aşımı. Timeout'ta retry YOK — OpenAI yine ücretlendirir. */
export const AI_ZAMAN_ASIMI_MS = Number(process.env.OPENAI_TIMEOUT_MS || 60000);

/**
 * Varsayılan max_output_tokens. Reasoning de bu havuzdan yer;
 * 12000 absürttü ve $6/1M'den yakıyordu.
 * Env: OPENAI_MAX_CIKTI
 */
export const AI_MAX_CIKTI = Number(process.env.OPENAI_MAX_CIKTI || 1500);

/** HamMesaj başına en fazla deneme (aşınca kalıcı HATA). */
export const AI_MAX_DENEME = Number(process.env.AI_MAX_DENEME || 2);
