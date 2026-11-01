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

/** Yönetici "üye paneline gir" görünümü (yönetici oturumu yanında ayrı çerez). */
export const GORUNUM_COOKIE = "nd_gorunum";

/** surum: üyenin oturum sürümü; hesaptaki sürüm artınca eski çerezler geçersiz olur */
export type Oturum = { rol: "admin"; surum: number } | { rol: "uye"; uyeId: number; surum: number };

async function tokenYap(onek: string, sureSn = OTURUM_SURE_SN): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + sureSn;
  const govde = `${onek}.${exp}`;
  return `${govde}.${await hmac(govde)}`;
}

/** Ön ek + geçerlilik + imza denetimi; geçerliyse ön eki döner. */
async function tokenCoz(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parcalar = token.split(".");
  if (parcalar.length !== 3) return null;
  const [onek, expStr, imza] = parcalar;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const beklenen = await hmac(`${onek}.${expStr}`);
  if (imza.length !== beklenen.length) return null;
  let fark = 0;
  for (let i = 0; i < imza.length; i++) {
    fark |= imza.charCodeAt(i) ^ beklenen.charCodeAt(i);
  }
  return fark === 0 ? onek : null;
}

/** Yönetici oturumu (eski biçim "ok.exp.imza" aynen geçerli). */
export async function oturumTokeniOlustur(surum = 0): Promise<string> {
  return tokenYap(surum > 0 ? `okv${surum}` : "ok");
}

/** Üye oturumu: "u<id>s<sürüm>.exp.imza" (eski "u<id>" sürüm 0 sayılır) */
export async function uyeTokeniOlustur(uyeId: number, surum = 0): Promise<string> {
  return tokenYap(`u${uyeId}s${surum}`);
}

/** Yöneticinin üye görünümü: "g<id>.exp.imza" (8 saat) */
export async function gorunumTokeniOlustur(uyeId: number): Promise<string> {
  return tokenYap(`g${uyeId}`, 60 * 60 * 8);
}

export async function oturumCoz(token: string | undefined | null): Promise<Oturum | null> {
  const onek = await tokenCoz(token);
  const y = onek ? /^ok(?:v(\d+))?$/.exec(onek) : null;
  if (y) return { rol: "admin", surum: Number(y[1] ?? 0) };
  const m = onek ? /^u(\d+)(?:s(\d+))?$/.exec(onek) : null;
  return m ? { rol: "uye", uyeId: Number(m[1]), surum: Number(m[2] ?? 0) } : null;
}

export async function gorunumCoz(token: string | undefined | null): Promise<number | null> {
  const onek = await tokenCoz(token);
  const m = onek ? /^g(\d+)$/.exec(onek) : null;
  return m ? Number(m[1]) : null;
}

/**
 * İstekte kim adına çalışılıyor: yönetici görünüm çerezi varsa o üye.
 * Middleware ve sunucu aynı kuralı kullanır.
 */
export async function etkinOturum(oturumToken: string | undefined | null, gorunumToken: string | undefined | null): Promise<(Oturum & { yoneticiGoruyor?: boolean }) | null> {
  const o = await oturumCoz(oturumToken);
  if (o?.rol === "admin") {
    const g = await gorunumCoz(gorunumToken);
    // Yönetici görünümü: sürüm yöneticinin kendi oturumunun sürümüdür
    if (g) return { rol: "uye", uyeId: g, surum: o.surum, yoneticiGoruyor: true };
  }
  return o;
}

export async function oturumGecerliMi(token: string | undefined | null): Promise<boolean> {
  return (await oturumCoz(token)) !== null;
}
