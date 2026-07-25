import type { CozulmusIlan } from "@/lib/ai/ilanCozumle";

export type KaynakTuru = "TELEGRAM" | "TELEGRAM_UYE" | "WEB" | "AI_ARAMA";

export const KAYNAK_TUR_ADLARI: Record<KaynakTuru, string> = {
  TELEGRAM: "Telegram grubu (bot)",
  TELEGRAM_UYE: "Telegram grubu (hesap)",
  WEB: "Yük ilan sitesi",
  AI_ARAMA: "AI web araması",
};

export type KaynakKaydi = {
  id: number;
  tur: string;
  ad: string;
  hedef: string;
};

/** Çözümlenmiş ilan + geldiği ham metin (dedup ve doğrulama için). */
export type BulunanIlan = {
  ilan: CozulmusIlan;
  hamMetin: string;
};

export type TaramaSonucu = {
  bulunanlar: BulunanIlan[];
  hata: string | null;
};

export type KaynakAdaptoru = {
  tur: KaynakTuru;
  tara: (kaynak: KaynakKaydi) => Promise<TaramaSonucu>;
};

export function bosSonuc(hata: string | null = null): TaramaSonucu {
  return { bulunanlar: [], hata };
}
