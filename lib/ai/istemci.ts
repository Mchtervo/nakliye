import {
  AI_MAX_CIKTI,
  AI_ZAMAN_ASIMI_MS,
  MODEL_HIZLI,
} from "@/lib/ai/modeller";
import { butceMusaitMi } from "@/lib/ai/butce";
import { maliyetHesapla } from "@/lib/ai/maliyet";
import { prisma } from "@/lib/prisma";

const API_URL = "https://api.openai.com/v1/responses";

export class AiHatasi extends Error {
  readonly kod: string;
  constructor(mesaj: string, kod = "AI_HATA") {
    super(mesaj);
    this.name = "AiHatasi";
    this.kod = kod;
  }
}

/** Test modu tek tur için kill switch'i yok sayar; cron'lar etkilenmez. */
let testBypass = false;

export async function aiTestBypassIle<T>(islem: () => Promise<T>): Promise<T> {
  testBypass = true;
  try {
    return await islem();
  } finally {
    testBypass = false;
  }
}

/** Kill switch: AI_KAPALI=true iken hiçbir OpenAI çağrısı yapılmaz. */
export function aiKapaliMi(): boolean {
  if (testBypass) return false;
  const v = (process.env.AI_KAPALI || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "evet" || v === "yes";
}

export function aiKullanilabilir(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && !aiKapaliMi();
}

export type AiGorsel = { url: string };

export type AiCabasi = "none" | "minimal" | "low" | "medium" | "high";

type OrtakSecenek = {
  sistem: string;
  metin: string;
  gorseller?: AiGorsel[];
  model?: string;
  caba?: AiCabasi;
  maxCikti?: number;
  zamanAsimiMs?: number;
  /** Logda hangi dosya/iş — zorunlu tutmaya çalış. */
  kaynak?: string;
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
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
    input_tokens_details?: { cached_tokens?: number };
  };
};

/** Responses API: max_output_tokens yüzünden yarım kalan cevap. */
function yanitKesildiMi(yanit: OpenAiYanit): string | null {
  const sebep = yanit.incomplete_details?.reason;
  if (yanit.status === "incomplete" || sebep) {
    return sebep || "incomplete";
  }
  return null;
}

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

function timeoutMu(hata: unknown): boolean {
  if (!(hata instanceof Error)) return false;
  const ad = hata.name || "";
  const mesaj = hata.message || "";
  return (
    ad === "TimeoutError" ||
    ad === "AbortError" ||
    mesaj.includes("aborted") ||
    mesaj.includes("Timeout") ||
    mesaj.includes("timeout")
  );
}

async function cagriLogla(kayit: {
  kaynak: string;
  model: string;
  girdiToken: number;
  ciktiToken: number;
  reasoningToken: number;
  maliyetMikro: number;
  basarili: boolean;
  hata: string | null;
  sureMs: number;
}): Promise<void> {
  try {
    await prisma.aiCagri.create({ data: kayit });
  } catch (e) {
    console.error("[ai-cagri-log]", e instanceof Error ? e.message : e);
  }
}

/**
 * Tek HTTP denemesi. Timeout'ta retry YOK.
 * Sadece 429 ve 5xx için en fazla 2 ek deneme.
 */
async function istekAt(
  govde: Record<string, unknown>,
  zamanAsimiMs: number,
  kaynak: string
): Promise<OpenAiYanit> {
  if (aiKapaliMi()) {
    throw new AiHatasi(
      "AI kapalı (AI_KAPALI=true). Yeni anahtar vermeden önce açma.",
      "AI_KAPALI"
    );
  }

  if (!(await butceMusaitMi())) {
    throw new AiHatasi(
      "Günlük AI bütçesi doldu — otomatik kesildi.",
      "BUTCE_DOLDU"
    );
  }

  const anahtar = process.env.OPENAI_API_KEY;
  if (!anahtar) {
    throw new AiHatasi(
      "OPENAI_API_KEY tanımlı değil. Ayarlar > AI bölümündeki adımları izle.",
      "ANAHTAR_YOK"
    );
  }

  const model = String(govde.model || MODEL_HIZLI);
  let sonGecici: AiHatasi | null = null;

  // deneme 0: asıl; 1-2: sadece 429/5xx
  for (let deneme = 0; deneme < 3; deneme++) {
    const bas = Date.now();
    try {
      const cevap = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anahtar}`,
        },
        body: JSON.stringify(govde),
        signal: AbortSignal.timeout(zamanAsimiMs),
        cache: "no-store",
      });

      const sureMs = Date.now() - bas;

      if (!cevap.ok) {
        const govdeMetni = await cevap.text().catch(() => "");
        if (cevap.status === 429 || cevap.status >= 500) {
          sonGecici = new AiHatasi(
            `OpenAI geçici hata (${cevap.status}).`,
            "GECICI"
          );
          await cagriLogla({
            kaynak,
            model,
            girdiToken: 0,
            ciktiToken: 0,
            reasoningToken: 0,
            maliyetMikro: 0,
            basarili: false,
            hata: sonGecici.message,
            sureMs,
          });
          await new Promise((c) => setTimeout(c, 800 * (deneme + 1)));
          continue;
        }
        if (cevap.status === 401) {
          throw new AiHatasi("OpenAI anahtarı geçersiz.", "ANAHTAR_GECERSIZ");
        }
        throw new AiHatasi(
          `OpenAI isteği reddetti (${cevap.status}): ${govdeMetni.slice(0, 300)}`,
          "ISTEK_HATASI"
        );
      }

      const yanit = (await cevap.json()) as OpenAiYanit;
      const girdiToken = yanit.usage?.input_tokens ?? 0;
      const ciktiToken = yanit.usage?.output_tokens ?? 0;
      const reasoningToken =
        yanit.usage?.output_tokens_details?.reasoning_tokens ?? 0;
      const maliyetMikro = maliyetHesapla({
        model,
        girdiToken,
        ciktiToken,
        reasoningToken,
      });

      const kesilme = yanitKesildiMi(yanit);
      if (kesilme) {
        // Parayı ödedik ama JSON yarım — başarı sayma; parti bölünsün.
        await cagriLogla({
          kaynak,
          model,
          girdiToken,
          ciktiToken,
          reasoningToken,
          maliyetMikro,
          basarili: false,
          hata: `KESILDI:${kesilme}`,
          sureMs,
        });
        console.warn(
          `[ai] KESILDI kaynak=${kaynak} model=${model} out=${ciktiToken} reason=${kesilme}`
        );
        await butceMusaitMi();
        throw new AiHatasi(
          `Yanıt max_output_tokens yüzünden kesildi (${kesilme}).`,
          "KESILDI"
        );
      }

      await cagriLogla({
        kaynak,
        model,
        girdiToken,
        ciktiToken,
        reasoningToken,
        maliyetMikro,
        basarili: true,
        hata: null,
        sureMs,
      });

      // Çağrı sonrası bütçe kontrolü (aştıysa bir sonrakini keser + Telegram).
      await butceMusaitMi();

      return yanit;
    } catch (hata) {
      const sureMs = Date.now() - bas;

      // Timeout: retry YOK. OpenAI işi bitirmiş olabilir, yeniden denemek
      // aynı işi 3 kez faturalandırır.
      if (timeoutMu(hata)) {
        await cagriLogla({
          kaynak,
          model,
          girdiToken: 0,
          ciktiToken: 0,
          reasoningToken: 0,
          maliyetMikro: 0,
          basarili: false,
          hata: `Timeout ${zamanAsimiMs}ms (retry yok)`,
          sureMs,
        });
        throw new AiHatasi(
          `OpenAI zaman aşımı (${zamanAsimiMs}ms). Retry yok.`,
          "TIMEOUT"
        );
      }

      if (hata instanceof AiHatasi) {
        if (hata.kod === "GECICI") {
          sonGecici = hata;
          continue;
        }
        await cagriLogla({
          kaynak,
          model,
          girdiToken: 0,
          ciktiToken: 0,
          reasoningToken: 0,
          maliyetMikro: 0,
          basarili: false,
          hata: hata.message.slice(0, 300),
          sureMs,
        });
        throw hata;
      }

      await cagriLogla({
        kaynak,
        model,
        girdiToken: 0,
        ciktiToken: 0,
        reasoningToken: 0,
        maliyetMikro: 0,
        basarili: false,
        hata: hata instanceof Error ? hata.message.slice(0, 300) : "ağ hatası",
        sureMs,
      });
      throw new AiHatasi(
        `OpenAI'ye ulaşılamadı: ${hata instanceof Error ? hata.message : "bilinmeyen"}`,
        "AG_HATASI"
      );
    }
  }

  if (sonGecici) throw sonGecici;
  throw new AiHatasi("OpenAI geçici hatalardan sonra vazgeçildi.", "GECICI");
}

function govdeKur(secenek: OrtakSecenek): Record<string, unknown> {
  const maxCikti = secenek.maxCikti ?? AI_MAX_CIKTI;
  const govde: Record<string, unknown> = {
    model: secenek.model || MODEL_HIZLI,
    input: girdiKur(secenek),
    reasoning: { effort: secenek.caba || "minimal" },
    max_output_tokens: maxCikti,
  };
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

  const yanit = await istekAt(
    govde,
    secenek.zamanAsimiMs || AI_ZAMAN_ASIMI_MS,
    secenek.kaynak || "aiJson"
  );
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
    secenek.zamanAsimiMs || AI_ZAMAN_ASIMI_MS,
    secenek.kaynak || "aiMetin"
  );
  return metniAyikla(yanit).trim();
}

export type AiFonksiyonTanim = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};

export type AiFonksiyonCagri = {
  callId: string;
  name: string;
  arguments: string;
};

type FonksiyonYanit = OpenAiYanit & {
  output?: {
    type?: string;
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: YanitParcasi[];
  }[];
};

function fonksiyonCagrilariniAyikla(yanit: FonksiyonYanit): AiFonksiyonCagri[] {
  const liste: AiFonksiyonCagri[] = [];
  for (const parca of yanit.output ?? []) {
    if (parca.type !== "function_call") continue;
    const callId = parca.call_id || parca.id;
    if (!callId || !parca.name) continue;
    liste.push({
      callId,
      name: parca.name,
      arguments: parca.arguments || "{}",
    });
  }
  return liste;
}

/**
 * Responses API + function calling döngüsü.
 * AI_KAPALI ise istekAt zaten fırlatır — çağıran önce kontrol etmeli.
 */
export async function aiAracli(secenek: {
  sistem: string;
  mesajlar: { rol: "user" | "assistant"; metin: string }[];
  araclar: AiFonksiyonTanim[];
  araciCalistir: (ad: string, argsJson: string) => Promise<unknown>;
  model?: string;
  caba?: AiCabasi;
  maxCikti?: number;
  zamanAsimiMs?: number;
  kaynak?: string;
  maxTur?: number;
}): Promise<string> {
  const maxTur = Math.min(Math.max(secenek.maxTur ?? 4, 1), 6);
  const input: unknown[] = [
    { role: "system", content: secenek.sistem },
    ...secenek.mesajlar.map((m) => ({
      role: m.rol === "assistant" ? "assistant" : "user",
      content: m.metin,
    })),
  ];

  const tools = secenek.araclar.map((a) => ({
    type: "function" as const,
    name: a.name,
    description: a.description,
    parameters: a.parameters,
    strict: a.strict !== false,
  }));

  for (let tur = 0; tur < maxTur; tur++) {
    const govde: Record<string, unknown> = {
      model: secenek.model || MODEL_HIZLI,
      input,
      tools,
      reasoning: { effort: secenek.caba || "minimal" },
      max_output_tokens: secenek.maxCikti ?? AI_MAX_CIKTI,
    };

    const yanit = (await istekAt(
      govde,
      secenek.zamanAsimiMs || AI_ZAMAN_ASIMI_MS,
      secenek.kaynak || "aiAracli"
    )) as FonksiyonYanit;

    const cagrilar = fonksiyonCagrilariniAyikla(yanit);
    if (cagrilar.length === 0) {
      return metniAyikla(yanit).trim();
    }

    for (const parca of yanit.output ?? []) {
      if (parca.type === "function_call") input.push(parca);
    }

    for (const c of cagrilar) {
      let cikti: unknown;
      try {
        cikti = await secenek.araciCalistir(c.name, c.arguments);
      } catch (e) {
        cikti = {
          hata: e instanceof Error ? e.message : "Araç hatası",
        };
      }
      input.push({
        type: "function_call_output",
        call_id: c.callId,
        output: JSON.stringify(cikti).slice(0, 12000),
      });
    }
  }

  throw new AiHatasi("Araç döngüsü üst sınırına ulaşıldı.", "ARAC_DONGU");
}

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
