import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { anaPrisma, semaliUrl, uyeSemasi } from "@/lib/prismaAna";

/** Kod ile gelen göç (migration) klasörleri. */
function gocAdlari(): string[] {
  const dizin = path.join(process.cwd(), "prisma", "migrations");
  return readdirSync(dizin, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

async function uygulanmisGocler(sema: string): Promise<Set<string> | null> {
  try {
    const satirlar = await anaPrisma.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM "${sema}"."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    );
    return new Set(satirlar.map((s) => s.migration_name));
  } catch {
    return null; // şema / tablo yok
  }
}

function gocCalistir(sema: string): Promise<void> {
  const dogrudan = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dogrudan) return Promise.reject(new Error("DIRECT_URL yok"));
  const url = semaliUrl(dogrudan, sema);
  const cli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  return new Promise((ok, red) => {
    execFile(
      process.execPath,
      [cli, "migrate", "deploy"],
      { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, timeout: 120_000 },
      (hata, _cikti, hataCikti) => (hata ? red(new Error(`Üye şeması hazırlanamadı (${sema}): ${hataCikti || hata.message}`)) : ok())
    );
  });
}

const hazir = new Map<number, Promise<void>>();
const bitti = new Set<number>();

/** Bu süreçte şeması hazırlanmış mı (beklemeden). */
export function uyeSemasiHazirMi(uyeId: number): boolean {
  return bitti.has(uyeId);
}

/**
 * Üye şemasını oluşturur / eksik göçleri uygular (süreç başına bir kez).
 * Yalnız üyenin kendi şemasına dokunur; ana şemaya göç uygulamaz.
 */
export function uyeSemasiHazirla(uyeId: number): Promise<void> {
  if (!Number.isInteger(uyeId) || uyeId <= 0) return Promise.reject(new Error("Geçersiz üye."));
  let p = hazir.get(uyeId);
  if (!p) {
    p = (async () => {
      const sema = uyeSemasi(uyeId);
      const uygulanan = await uygulanmisGocler(sema);
      const eksik = !uygulanan || gocAdlari().some((g) => !uygulanan.has(g));
      if (eksik) await gocCalistir(sema);
    })();
    // Hata olursa sonraki istekte yeniden denensin
    p.then(() => bitti.add(uyeId)).catch(() => hazir.delete(uyeId));
    hazir.set(uyeId, p);
  }
  return p;
}
