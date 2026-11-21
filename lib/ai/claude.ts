/**
 * Claude (Anthropic) yolu. İstemci (lib/ai/istemci) OpenAI Responses biçiminde
 * gövde kurar; model adı "claude:" ile başlarsa istek buraya gelir, Anthropic
 * Messages API'ye çevrilir ve cevap aynı biçimde geri döner. Böylece ilan
 * çözümleyici ve diğer işler değişmeden iki sağlayıcıyla da çalışır.
 */
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_ONEK = "claude:";

let istemci: Anthropic | null = null;
function claudeIstemcisi(): Anthropic {
  // Yeniden deneme istemci tarafında (istekAt) yapılır: SDK kendi başına denemesin
  istemci ??= new Anthropic({ maxRetries: 0 });
  return istemci;
}

export function claudeAnahtariVar(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type GirdiParcasi = { type?: string; text?: string; image_url?: string };

type ClaudeIcerik =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } }
  | { type: "image"; source: { type: "url"; url: string } };

/** Responses biçimindeki görsel (data: URL ya da https) → Claude görsel bloğu. */
function gorselBlogu(url: string): ClaudeIcerik | null {
  const m = url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (m) return { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } };
  if (/^https:\/\//.test(url)) return { type: "image", source: { type: "url", url } };
  return null;
}
type Girdi = { role: "system" | "user"; content: string | GirdiParcasi[] }[];

export type ClaudeYanit = {
  status: "completed" | "incomplete";
  output_text: string;
  incomplete_details?: { reason?: string };
  usage: { input_tokens: number; output_tokens: number; output_tokens_details: { reasoning_tokens: number } };
};

/** OpenAI çabası → Claude effort (ilan çözümü gibi basit işlerde "low"). */
function effort(caba: unknown): "low" | "medium" | "high" {
  if (caba === "high" || caba === "xhigh") return "high";
  if (caba === "medium") return "medium";
  return "low";
}

// Okuyucular (daemon) Node'un "yalnız tip sil" kipinde çalışır: kısa alan
// tanımı (constructor'da readonly parametre) orada desteklenmez, alanlar açık yazılır.
export class ClaudeHttpHatasi extends Error {
  readonly durum: number | null;
  readonly kod: "KREDI_BITTI" | "GECICI" | "ANAHTAR_GECERSIZ" | "DIGER";
  constructor(message: string, durum: number | null, kod: "KREDI_BITTI" | "GECICI" | "ANAHTAR_GECERSIZ" | "DIGER") {
    super(message);
    this.durum = durum;
    this.kod = kod;
  }
}

/** OpenAI Responses biçimindeki gövdeyi Claude'a gönderir. */
export async function claudeIstek(govde: Record<string, unknown>, zamanAsimiMs: number): Promise<ClaudeYanit> {
  const model = String(govde.model).slice(CLAUDE_ONEK.length);
  const girdi = (govde.input as Girdi) ?? [];
  const sistem = girdi
    .filter((g) => g.role === "system")
    .map((g) => (typeof g.content === "string" ? g.content : g.content.map((p) => p.text ?? "").join("\n")))
    .join("\n\n");
  const kullanici = girdi
    .filter((g) => g.role === "user")
    .map((g) => (typeof g.content === "string" ? g.content : g.content.filter((p) => p.type === "input_text").map((p) => p.text ?? "").join("\n")))
    .join("\n\n");
  // Görseller (fiş vb.): metinden önce
  const gorseller = girdi
    .filter((g) => g.role === "user" && typeof g.content !== "string")
    .flatMap((g) => (g.content as GirdiParcasi[]).filter((p) => p.type === "input_image" && p.image_url).map((p) => gorselBlogu(p.image_url!)))
    .filter((b): b is ClaudeIcerik => b !== null);
  const icerik: string | ClaudeIcerik[] = gorseller.length ? [...gorseller, { type: "text", text: kullanici }] : kullanici;
  const reasoning = govde.reasoning as { effort?: string } | undefined;
  const sema = (govde.text as { format?: { type?: string; schema?: Record<string, unknown> } } | undefined)?.format;

  try {
    const yanit = await claudeIstemcisi().messages.create(
      {
        model,
        // Düşünme tokenleri de bu sınıra dahil: OpenAI için ayarlı sınır (2500) uzun listelerde
        // cevabı yarıda kesiyordu. Yalnız kullanılan token faturalanır.
        max_tokens: Math.max((Number(govde.max_output_tokens) || 4000) * 3, 8000),
        ...(sistem ? { system: sistem } : {}),
        messages: [{ role: "user", content: icerik }],
        output_config: {
          effort: effort(reasoning?.effort),
          ...(sema?.type === "json_schema" && sema.schema ? { format: { type: "json_schema" as const, schema: sema.schema } } : {}),
        },
      },
      { timeout: zamanAsimiMs }
    );
    const metin = yanit.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const yarim = yanit.stop_reason === "max_tokens" || yanit.stop_reason === "refusal";
    return {
      status: yarim ? "incomplete" : "completed",
      output_text: metin,
      ...(yarim ? { incomplete_details: { reason: yanit.stop_reason === "refusal" ? "content_filter" : "max_output_tokens" } } : {}),
      usage: {
        input_tokens: yanit.usage.input_tokens + (yanit.usage.cache_read_input_tokens ?? 0) + (yanit.usage.cache_creation_input_tokens ?? 0),
        output_tokens: yanit.usage.output_tokens,
        output_tokens_details: { reasoning_tokens: 0 },
      },
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new ClaudeHttpHatasi("Claude anahtarı geçersiz.", e.status ?? null, "ANAHTAR_GECERSIZ");
    }
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) {
      throw new ClaudeHttpHatasi("Claude kredisi bitti.", 400, "KREDI_BITTI");
    }
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      throw new ClaudeHttpHatasi(`Claude geçici hata (${e instanceof Anthropic.APIError ? e.status : "bağlantı"}).`, e instanceof Anthropic.APIError ? (e.status ?? null) : null, "GECICI");
    }
    if (e instanceof Anthropic.APIError) {
      throw new ClaudeHttpHatasi(`Claude hata (${e.status}): ${e.message.slice(0, 200)}`, e.status ?? null, "DIGER");
    }
    throw e;
  }
}
