import { PrismaClient } from "@prisma/client";

/**
 * Ana şema istemcisi (yönetici verisi + üye hesapları). Uygulama kodu
 * `@/lib/prisma`yı kullanır; bunu yalnız üye hesabı / şema işleri kullanır.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; uyeIstemcileri?: Map<number, PrismaClient> };

function istemci(url?: string): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

export const anaPrisma = globalForPrisma.prisma ?? istemci();
// Netlify/serverless'ta da tek instance tutmaya çalış
globalForPrisma.prisma = anaPrisma;

/** Üye şeması adı (yerel denemede UYE_SEMA_ONEK ile ayrı ön ek: gerçek üye şemalarına karışmaz). */
export const uyeSemasi = (uyeId: number) => `${process.env.UYE_SEMA_ONEK || "uye_"}${uyeId}`;

/** Bağlantı adresine şema ekler (Prisma tablo adlarını bu şemayla niteler). */
export function semaliUrl(url: string, sema: string): string {
  const u = new URL(url);
  u.searchParams.set("schema", sema);
  return u.toString();
}

const uyeIstemcileri = (globalForPrisma.uyeIstemcileri ??= new Map());

/** Üyenin kendi şemasına bağlı istemci (süreç başına bir tane). */
export function uyeIstemcisi(uyeId: number): PrismaClient {
  let c = uyeIstemcileri.get(uyeId);
  if (!c) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL yok");
    // Üye başına küçük havuz. 2 iken ana sayfanın eşzamanlı sorguları sıraya
    // girip 10 sn'de P2024 veriyordu (canlı logda yüzlerce; ekran kararıyordu).
    // Supabase pgbouncer (6543) istemci bağlantısını ucuz tutar.
    const u = new URL(semaliUrl(url, uyeSemasi(uyeId)));
    u.searchParams.set("connection_limit", "5");
    u.searchParams.set("pool_timeout", "20");
    c = istemci(u.toString());
    uyeIstemcileri.set(uyeId, c);
  }
  return c;
}
