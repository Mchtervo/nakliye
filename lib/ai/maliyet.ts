/**
 * OpenAI GPT-5.6 resmi fiyatları (USD / 1M token).
 * https://developers.openai.com/api/docs/pricing
 *
 * Reasoning token'ları çıktı fiyatından faturalanır.
 */

export type ModelFiyat = { girdi: number; cikti: number };

const FIYATLAR: Record<string, ModelFiyat> = {
  "gpt-5.6-luna": { girdi: 1.0, cikti: 6.0 },
  "gpt-5.6-terra": { girdi: 2.5, cikti: 15.0 },
  "gpt-5.6-sol": { girdi: 5.0, cikti: 30.0 },
  "gpt-5.6": { girdi: 5.0, cikti: 30.0 },
};

/** Bilinmeyen modelde terra fiyatı (güvenli taraf). */
export function modelFiyati(model: string): ModelFiyat {
  return FIYATLAR[model] ?? FIYATLAR["gpt-5.6-terra"];
}

/**
 * Maliyeti mikrodolar cinsinden hesaplar (1 USD = 1_000_000).
 * Reasoning token çıktıya dahildir; ayrı verilmişse çift sayma.
 */
export function maliyetHesapla(args: {
  model: string;
  girdiToken: number;
  ciktiToken: number;
  reasoningToken?: number;
}): number {
  const f = modelFiyati(args.model);
  // OpenAI'da output_tokens genelde reasoning'i de içerir.
  // Ayrı verilmişse ve cikti'den büyükse yine cikti üzerinden gideriz.
  const cikti = Math.max(0, args.ciktiToken);
  const girdi = Math.max(0, args.girdiToken);
  const usd = (girdi * f.girdi + cikti * f.cikti) / 1_000_000;
  return Math.round(usd * 1_000_000);
}

export function mikrodolarYaz(mikro: number): string {
  const usd = mikro / 1_000_000;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** Günlük bütçe (USD). Env: AI_GUNLUK_LIMIT_USD, varsayılan 1. */
export function gunlukButceUsd(): number {
  const ham = Number(process.env.AI_GUNLUK_LIMIT_USD);
  if (Number.isFinite(ham) && ham > 0) return ham;
  return 1;
}
