export const OTURUM_COOKIE = "nd_oturum";
export const OTURUM_SURE_SN = 60 * 60 * 24 * 30; // 30 gün

export function secret(): string {
  return process.env.SESSION_SECRET || "nakliye-defteri-yerel-secret-degistir";
}

export function uygulamaSifresi(): string {
  return process.env.APP_SIFRE || "nakliye2026";
}

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === "function"
      ? btoa(s)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

let hmacAnahtar: CryptoKey | null = null;

async function hmacAnahtari(): Promise<CryptoKey> {
  if (hmacAnahtar) return hmacAnahtar;
  const enc = new TextEncoder();
  hmacAnahtar = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hmacAnahtar;
}

async function hmac(govde: string): Promise<string> {
  const key = await hmacAnahtari();
  const imza = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(govde)
  );
  return toBase64Url(imza);
}

export async function oturumTokeniOlustur(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + OTURUM_SURE_SN;
  const govde = `ok.${exp}`;
  const imza = await hmac(govde);
  return `${govde}.${imza}`;
}

export async function oturumGecerliMi(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;
  const parcalar = token.split(".");
  if (parcalar.length !== 3) return false;
  const [ok, expStr, imza] = parcalar;
  if (ok !== "ok") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const govde = `${ok}.${expStr}`;
  const beklenen = await hmac(govde);
  if (imza.length !== beklenen.length) return false;
  let fark = 0;
  for (let i = 0; i < imza.length; i++) {
    fark |= imza.charCodeAt(i) ^ beklenen.charCodeAt(i);
  }
  return fark === 0;
}
