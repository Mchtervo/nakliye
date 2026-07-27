/**
 * Model seçimleri tek yerde tutulur; OpenAI model adı değişirse
 * sadece burası (veya env değişkenleri) güncellenir.
 */

/**
 * Yüksek hacimli işler: ilan çözümleme, fiş OCR.
 * gpt-5.6 ailesinde en ucuz Luna ($1/$6); basit JSON çıkarma için
 * gpt-5.4-nano ~5× ucuz ($0.20/$1.25) — varsayılan nano.
 * Luna'ya dönmek için: OPENAI_MODEL_HIZLI=gpt-5.6-luna
 */
export const MODEL_HIZLI = process.env.OPENAI_MODEL_HIZLI || "gpt-5.4-nano";

/** Muhakeme isteyen işler: günlük analiz, firma bulma. */
export const MODEL_ANALIZ = process.env.OPENAI_MODEL_ANALIZ || "gpt-5.6-terra";

/** İstek zaman aşımı. Timeout'ta retry YOK — OpenAI yine ücretlendirir. */
export const AI_ZAMAN_ASIMI_MS = Number(process.env.OPENAI_TIMEOUT_MS || 60000);

/**
 * Varsayılan max_output_tokens. Parçalama (max 5 rota) sonrası
 * 1500'e dayanmamalı; kesilmiş cevap israf → emniyet 2500.
 * Env: OPENAI_MAX_CIKTI
 */
export const AI_MAX_CIKTI = Number(process.env.OPENAI_MAX_CIKTI || 2500);

/** HamMesaj başına en fazla deneme (aşınca kalıcı HATA). */
export const AI_MAX_DENEME = Number(process.env.AI_MAX_DENEME || 2);
