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
type GirdiOgesi =
  | { role: "system" | "user" | "assistant"; content: string | GirdiParcasi[] }
  | { type: "function_call"; call_id?: string; id?: string; name?: string; arguments?: string; _claude?: unknown[] }
  | { type: "function_call_output"; call_id?: string; output?: string };

export type ClaudeYanit = {
  status: "completed" | "incomplete";
  output_text: string;
  incomplete_details?: { reason?: string };
  /** Araç çağrıları (Responses biçimi): aiAracli bunları okur ve sonucu geri yollar */
  output?: { type: "function_call"; call_id: string; name: string; arguments: string; _claude?: unknown[] }[];
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

type CMesaj = { role: "user" | "assistant"; content: unknown[] };

function parcalar(content: string | GirdiParcasi[]): unknown[] {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  const gorseller = content.filter((p) => p.type === "input_image" && p.image_url).map((p) => gorselBlogu(p.image_url!)).filter(Boolean);
  const metin = content.filter((p) => p.type !== "input_image").map((p) => p.text ?? "").join("\n");
  return [...gorseller, ...(metin ? [{ type: "text", text: metin }] : [])];
}

/** Responses girdisi (mesajlar + araç çağrıları/sonuçları) → Claude sistem + mesajlar. */
function mesajlariKur(girdi: GirdiOgesi[]): { sistem: string; mesajlar: CMesaj[] } {
  const sistem: string[] = [];
  const mesajlar: CMesaj[] = [];
  const ekle = (role: CMesaj["role"], bloklar: unknown[]) => {
    if (!bloklar.length) return;
    const son = mesajlar[mesajlar.length - 1];
    if (son && son.role === role) son.content.push(...bloklar);
    else mesajlar.push({ role, content: [...bloklar] });
  };
  for (const g of girdi) {
    if ("role" in g) {
      if (g.role === "system") sistem.push(typeof g.content === "string" ? g.content : g.content.map((p) => p.text ?? "").join("\n"));
      else ekle(g.role, parcalar(g.content));
    } else if (g.type === "function_call") {
      // Claude'un orijinal bloklarını (düşünme dahil) aynen geri ver; bir kez
      if (g._claude) {
        const son = mesajlar[mesajlar.length - 1];
        if (!(son && son.role === "assistant" && son.content.includes(g._claude[0]))) ekle("assistant", g._claude);
      } else {
        let input: unknown = {};
        try {
          input = JSON.parse(g.arguments || "{}");
        } catch {
          input = {};
        }
        ekle("assistant", [{ type: "tool_use", id: g.call_id || g.id, name: g.name, input }]);
      }
    } else if (g.type === "function_call_output") {
      ekle("user", [{ type: "tool_result", tool_use_id: g.call_id, content: g.output ?? "" }]);
    }
  }
  return { sistem: sistem.join("\n\n"), mesajlar };
}

/** Responses araçları → Claude araçları (fonksiyon + web araması). */
function araclariKur(araclar: unknown): unknown[] {
  if (!Array.isArray(araclar)) return [];
  const out: unknown[] = [];
  for (const a of araclar as { type?: string; name?: string; description?: string; parameters?: unknown }[]) {
    if (a.type === "function" && a.name) out.push({ name: a.name, description: a.description ?? "", input_schema: a.parameters ?? { type: "object", properties: {} } });
    else if (a.type === "web_search" || a.type === "web_search_preview") out.push({ type: "web_search_20250305", name: "web_search", max_uses: 5 });
  }
  return out;
}

/** OpenAI Responses biçimindeki gövdeyi Claude'a gönderir (metin, görsel, JSON şeması, araçlar, web araması). */
export async function claudeIstek(govde: Record<string, unknown>, zamanAsimiMs: number): Promise<ClaudeYanit> {
  const model = String(govde.model).slice(CLAUDE_ONEK.length);
  const { sistem, mesajlar } = mesajlariKur((govde.input as GirdiOgesi[]) ?? []);
  const araclar = araclariKur(govde.tools);
  const reasoning = govde.reasoning as { effort?: string } | undefined;
  const sema = (govde.text as { format?: { type?: string; schema?: Record<string, unknown> } } | undefined)?.format;
  const bitis = Date.now() + zamanAsimiMs;

  try {
    let girdi = 0;
    let cikti = 0;
    const tumBloklar: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] = [];
    let durus: string | null = null;
    // Web araması uzun sürerse Claude "pause_turn" ile döner: kaldığı yerden devam ettir
    for (let tur = 0; tur < 4; tur++) {
      const kalan = Math.max(5_000, bitis - Date.now());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const istek: any = {
        model,
        // Düşünme tokenleri de bu sınıra dahil: OpenAI için ayarlı sınır (2500) uzun listelerde
        // cevabı yarıda kesiyordu. Yalnız kullanılan token faturalanır.
        max_tokens: Math.max((Number(govde.max_output_tokens) || 4000) * 3, 8000),
        ...(sistem ? { system: sistem } : {}),
        messages: mesajlar,
        ...(araclar.length ? { tools: araclar } : {}),
        output_config: {
          effort: effort(reasoning?.effort),
          ...(sema?.type === "json_schema" && sema.schema ? { format: { type: "json_schema" as const, schema: sema.schema } } : {}),
        },
      };
      const yanit = await claudeIstemcisi().messages.create(istek, { timeout: kalan });
      girdi += yanit.usage.input_tokens + (yanit.usage.cache_read_input_tokens ?? 0) + (yanit.usage.cache_creation_input_tokens ?? 0);
      cikti += yanit.usage.output_tokens;
      tumBloklar.push(...(yanit.content as unknown as typeof tumBloklar));
      durus = yanit.stop_reason;
      if (durus !== "pause_turn") break;
      mesajlar.push({ role: "assistant", content: yanit.content as unknown[] });
    }
    const metin = tumBloklar.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    const cagrilar = tumBloklar.filter((b) => b.type === "tool_use");
    const output = cagrilar.map((b, i) => ({
      type: "function_call" as const,
      call_id: b.id ?? "",
      name: b.name ?? "",
      arguments: JSON.stringify(b.input ?? {}),
      // İlk çağrı, Claude'un tam cevabını taşır (sonraki turda aynen geri verilir)
      ...(i === 0 ? { _claude: tumBloklar as unknown[] } : {}),
    }));
    const yarim = durus === "max_tokens" || durus === "refusal";
    return {
      status: yarim ? "incomplete" : "completed",
      output_text: metin,
      ...(output.length ? { output } : {}),
      ...(yarim ? { incomplete_details: { reason: durus === "refusal" ? "content_filter" : "max_output_tokens" } } : {}),
      usage: { input_tokens: girdi, output_tokens: cikti, output_tokens_details: { reasoning_tokens: 0 } },
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
