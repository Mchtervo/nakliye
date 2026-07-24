import path from "node:path";

/** Kalıcı veri kökü (Docker/Railway volume). Yoksa proje içi. */
export function dataDir(): string {
  return process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

/** Fiş fotoğraflarının yazıldığı klasör */
export function uploadDir(): string {
  if (process.env.DATA_DIR?.trim()) {
    return path.join(process.env.DATA_DIR.trim(), "uploads");
  }
  // Yerel geliştirme: public altında (statik de servis edilir)
  return path.join(process.cwd(), "public", "uploads");
}

/** Yedek için SQLite dosya yolu */
export function dbDosyaYolu(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url?.startsWith("file:")) {
    const ham = url.slice("file:".length);
    if (path.isAbsolute(ham)) return ham;
    // Prisma göreli yolu prisma/ klasörüne göre çözer
    return path.resolve(process.cwd(), "prisma", ham);
  }
  if (process.env.DATA_DIR?.trim()) {
    return path.join(process.env.DATA_DIR.trim(), "dev.db");
  }
  return path.join(process.cwd(), "prisma", "dev.db");
}
