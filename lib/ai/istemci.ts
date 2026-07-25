import { AI_ZAMAN_ASIMI_MS, MODEL_HIZLI } from "@/lib/ai/modeller";

const API_URL = "https://api.openai.com/v1/responses";

export class AiHatasi extends Error {
  readonly kod: string;
  constructor(mesaj: string, kod = "AI_HATA") {
    super(mesaj);
    this.name = "AiHatasi";
    this.kod = kod;
  }
}

export function aiKullanilabilir(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type AiGorsel = { url: string };

export type AiCabasi = "none" | "low" | "medium" | "high";

type OrtakSecenek = {
  sistem: string;
  metin: string;
  gorseller?: AiGorsel[];
  model?: string;
  caba?: AiCabasi;
  maxCikti?: number;
  zamanAsimiMs?: number;
  /** OpenAI'nin kendi web arama aracını açar. */
  webArama?: boolean;
};

type IcerikParcasi =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

function girdiKur(secenek: OrtakSecenek) {
  const parcalar: IcerikParcasi[] = [{ type: "input_text", text: secenek.metin }];
  for (const g of secenek.gorseller ?? []) {
    parcalar.push({ type: "input_image", image_url: g.url, detail: "auto" });
  }
  return [
    { role: "system" as const, content: secenek.sistem },
    { role: "user" as const, content: parcalar },
  ];
}

type YanitParcasi = {
  type?: string;
  text?: string;
  refusal?: string;
};

type OpenAiYanit = {
  status?: string;
  output_text?: string;
  incomplete_details?: { reason?: string };
  output?: { type?: string; content?: YanitParcasi[] }[];
  error?: { message?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
};

function metniAyikla(yanit: OpenAiYanit): string {
  if (typeof yanit.output_text === "string" && yanit.output_text.trim()) {
    return yanit.output_text;
  }
  for (const parca of yanit.output ?? []) {
    if (parca.type !== "message") continue;
    for (const icerik of parca.content ?? []) {
      if (icerik.type === "refusal" && icerik.refusal) {
        throw new AiHatasi(`Model isteği reddetti: ${icerik.refusal}`, "RED");
      }
      if (icerik.type === "output_text" && icerik.text) return icerik.text;
    }
  }
  if (yanit.incomplete_details?.reason) {
    throw new AiHatasi(
      `Yanıt tamamlanamadı (${yanit.incomplete_details.reason}).`,
      "EKSIK"
    );
  }
  throw new AiHatasi("Modelden metin yanıtı alınamadı.", "BOS_YANIT");
}

async function istekAt(
  govde: Record<string, unknown>,
  zamanAsimiMs: number
): Promise<OpenAiYanit> {
  const anahtar = process.env.OPENAI_API_KEY;
  if (!anahtar) {
    throw new AiHatasi(
      "OPENAI_API_KEY tanımlı değil. Ayarlar > AI bölümündeki adımları izle.",
      "ANAHTAR_YOK"
    );
  }

  let sonHata: unknown = null;

  for (let deneme = 0; deneme < 3; deneme++) {
    const kontrol = AbortSignal.timeout(zamanAsimiMs);
    try {
      const cevap = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anahtar}`,
        },
        body: JSON.stringify(govde),
        signal: kontrol,
        cache: "no-store",
      });

      if (cevap.ok) return (await cevap.json()) as OpenAiYanit;

      const govdeMetni = await cevap.text().catch(() => "");
      // 429 ve 5xx geçici; tekrar denenir.
      if (cevap.status === 429 || cevap.status >= 500) {
        sonHata = new AiHatasi(
          `OpenAI geçici hata (${cevap.status}).`,
          "GECICI"
        );
      } else if (cevap.status === 401) {
        throw new AiHatasi("OpenAI anahtarı geçersiz.", "ANAHTAR_GECERSIZ");
      } else {
        throw new AiHatasi(
          `OpenAI isteği reddetti (${cevap.status}): ${govdeMetni.slice(0, 300)}`,
          "ISTEK_HATASI"
        );
      }
    } catch (hata) {
      if (hata instanceof AiHatasi && hata.kod !== "GECICI") throw hata;
      sonHata = hata;
    }

    await new Promise((c) => setTimeout(c, 700 * (deneme + 1)));
  }

  if (sonHata instanceof AiHatasi) throw sonHata;
  throw new AiHatasi(
    `OpenAI'ye ulaşılamadı: ${sonHata instanceof Error ? sonHata.message : "bilinmeyen hata"}`,
    "AG_HATASI"
  );
}

function govdeKur(secenek: OrtakSecenek): Record<string, unknown> {
  const govde: Record<string, unknown> = {
    model: secenek.model || MODEL_HIZLI,
    input: girdiKur(secenek),
    reasoning: { effort: secenek.caba || "low" },
  };
  if (secenek.maxCikti) govde.max_output_tokens = secenek.maxCikti;
  if (secenek.webArama) govde.tools = [{ type: "web_search" }];
  return govde;
}

/** Şemaya uyan JSON döndürür (Structured Outputs). */
export async function aiJson<T>(
  secenek: OrtakSecenek & { semaAdi: string; sema: Record<string, unknown> }
): Promise<T> {
  const govde = govdeKur(secenek);
  govde.text = {
    format: {
      type: "json_schema",
      name: secenek.semaAdi,
      strict: true,
      schema: secenek.sema,
    },
  };

  const yanit = await istekAt(govde, secenek.zamanAsimiMs || AI_ZAMAN_ASIMI_MS);
  const metin = metniAyikla(yanit);

  try {
    return JSON.parse(metin) as T;
  } catch {
    throw new AiHatasi("Model geçersiz JSON döndürdü.", "JSON_HATASI");
  }
}

/** Serbest metin döndürür (analiz raporu gibi). */
export async function aiMetin(secenek: OrtakSecenek): Promise<string> {
  const yanit = await istekAt(
    govdeKur(secenek),
    secenek.zamanAsimiMs || AI_ZAMAN_ASIMI_MS
  );
  return metniAyikla(yanit).trim();
}

/**
 * Hata fırlatmayan sarmalayıcı: arka plan işlerinde tek bir kaynağın
 * patlaması tüm taramayı durdurmasın diye kullanılır.
 */
export async function aiDene<T>(
  islem: () => Promise<T>
): Promise<{ sonuc: T; hata: null } | { sonuc: null; hata: string }> {
  try {
    return { sonuc: await islem(), hata: null };
  } catch (hata) {
    const mesaj =
      hata instanceof Error ? hata.message : "Bilinmeyen AI hatası";
    console.error("[ai]", mesaj);
    return { sonuc: null, hata: mesaj };
  }
}
