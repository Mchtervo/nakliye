import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { uygulamaSifresi } from "@/lib/auth";

export function sifreHashle(sifre: string): string {
  const tuz = randomBytes(16).toString("hex");
  const hash = scryptSync(sifre, tuz, 32).toString("hex");
  return `${tuz}:${hash}`;
}

export function sifreDogrula(sifre: string, kayitli: string): boolean {
  if (!kayitli.includes(":")) {
    // Düz metin (env varsayılanı)
    const a = Buffer.from(sifre);
    const b = Buffer.from(kayitli);
    if (a.length !== b.length) {
      // uzunluk farklıysa yine de env fallback dene
      return sifre === uygulamaSifresi();
    }
    return timingSafeEqual(a, b);
  }
  const [tuz, hash] = kayitli.split(":");
  if (!tuz || !hash) return false;
  const hesap = scryptSync(sifre, tuz, 32).toString("hex");
  try {
    const aa = Buffer.from(hesap);
    const bb = Buffer.from(hash);
    if (aa.length !== bb.length) return false;
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

/** Basit fingerprint — yedek dosya adı için */
export function kisaId(): string {
  return createHash("sha1")
    .update(String(Date.now()) + randomBytes(4).toString("hex"))
    .digest("hex")
    .slice(0, 8);
}
