/**
 * NVIDIA (build.nvidia.com, ücretsiz deneme hakkı) yolu. Model adı "nvidia:" ile
 * başlarsa istemci (lib/ai/istemci) gövdeyi buraya verir: OpenAI Responses biçimi
 * → Chat Completions'a çevrilir, cevap Responses biçiminde döner.
 * Dakika başı istek sınırı var; ana model değil, yedek / ücretsiz yardımcı.
 */
export const NVIDIA_ONEK = "nvidia:";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/** İlan çözümünde yedek (ölçüm 21.11: doğru JSON, 3–4 sn). */
export const NVIDIA_ILAN_MODELI = process.env.NVIDIA_ILAN_MODELI || "nvidia:minimaxai/minimax-m3.1-flash";
/** Fotoğraf okuma yedeği (EVREN olmazsa). */
export const NVIDIA_GORSEL_MODELI = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

export function nvidiaAnahtariVar(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

type Parca = { type?: string; text?: string; image_url?: string };
type Girdi = { role: "system" | "user"; content: string | Parca[] }[];

export class NvidiaHatasi extends Error {
  readonly durum: number;
  constructor(message: string, durum: number) {
    super(message);
    this.durum = durum;
  }
}

export type NvidiaYanit = {
  status: "completed" | "incomplete";
  output_text: string;
  incomplete_details?: { reason?: string };
  usage: { input_tokens: number; output_tokens: number; output_tokens_details: { reasoning_tokens: number } };
};

function mesajlar(girdi: Girdi) {
  return girdi.map((g) => {
    if (typeof g.content === "string") return { role: g.role, content: g.content };
    const icerik = g.content.map((p) =>
      p.type === "input_image" && p.image_url
        ? { type: "image_url", image_url: { url: p.image_url } }
        : { type: "text", text: p.text ?? "" }
    );
    return { role: g.role, content: g.role === "system" ? icerik.map((p) => ("text" in p ? p.text : "")).join("\n") : icerik };
  });
}

/** Cevaptaki JSON'u ayıkla (```json bloğu ya da baştaki/sondaki laf). */
function jsonAyikla(metin: string): string {
  const blok = metin.match(/```(?:json)?\s*([\s\S]*?)```/);
  const ham = (blok ? blok[1] : metin).trim();
  const bas = ham.search(/[[{]/);
  if (bas < 0) return ham;
  const son = Math.max(ham.lastIndexOf("}"), ham.lastIndexOf("]"));
  return son > bas ? ham.slice(bas, son + 1) : ham;
}

export async function nvidiaIstek(govde: Record<string, unknown>, zamanAsimiMs: number): Promise<NvidiaYanit> {
  const model = String(govde.model).slice(NVIDIA_ONEK.length);
  const sema = (govde.text as { format?: { type?: string; schema?: Record<string, unknown> } } | undefined)?.format;
  const jsonIsteniyor = sema?.type === "json_schema";
  const girdi = (govde.input as Girdi) ?? [];
  const msj = mesajlar(girdi);
  if (jsonIsteniyor && sema?.schema) {
    // Şemayı açıkça yaz: her model response_format desteklemiyor
    msj.unshift({ role: "system", content: `Yalnızca bu JSON şemasına uyan geçerli JSON döndür, başka hiçbir şey yazma:\n${JSON.stringify(sema.schema)}` });
  }
  const r = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: msj,
      temperature: 0,
      max_tokens: Math.max(Number(govde.max_output_tokens) || 2000, 2000),
      ...(jsonIsteniyor ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(zamanAsimiMs),
  });
  if (!r.ok) throw new NvidiaHatasi(`NVIDIA ${r.status}: ${(await r.text()).slice(0, 200)}`, r.status);
  const j = (await r.json()) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const secim = j.choices?.[0];
  const icerik = secim?.message?.content ?? "";
  const yarim = secim?.finish_reason === "length";
  return {
    status: yarim ? "incomplete" : "completed",
    output_text: jsonIsteniyor ? jsonAyikla(icerik) : icerik,
    ...(yarim ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    usage: {
      input_tokens: j.usage?.prompt_tokens ?? 0,
      output_tokens: j.usage?.completion_tokens ?? 0,
      output_tokens_details: { reasoning_tokens: 0 },
    },
  };
}

/** Fotoğraftaki yazı (OCR yedeği). */
export async function nvidiaGorselMetni(dataUrl: string, zamanAsimiMs = 40_000): Promise<string | null> {
  if (!nvidiaAnahtariVar()) return null;
  const y = await nvidiaIstek(
    {
      model: NVIDIA_ONEK + NVIDIA_GORSEL_MODELI,
      max_output_tokens: 1500,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Görseldeki yazıyı aynen, satır satır yaz. Başka hiçbir şey yazma. Yazı yoksa boş bırak." },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    },
    zamanAsimiMs
  );
  return y.output_text.trim() || null;
}
