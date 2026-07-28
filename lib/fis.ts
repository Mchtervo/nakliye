import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { uploadDir } from "@/lib/yollar";
import { FIS_BUCKET, supabaseAdmin, supabaseHazirMi } from "@/lib/supabase";

export const MAX_FIS_BOYUT = 8 * 1024 * 1024; // 8 MB

const IZINLI_TIPLER: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

function uzantiBul(dosya: File): string | null {
  let uzanti = IZINLI_TIPLER[dosya.type];
  if (uzanti) return uzanti;
  const ad = dosya.name.toLowerCase();
  if (ad.endsWith(".jpg") || ad.endsWith(".jpeg")) return ".jpg";
  if (ad.endsWith(".png")) return ".png";
  if (ad.endsWith(".webp")) return ".webp";
  if (ad.endsWith(".heic")) return ".heic";
  if (ad.endsWith(".heif")) return ".heif";
  return null;
}

function mimeBul(uzanti: string): string {
  const ters = Object.entries(IZINLI_TIPLER).find(([, u]) => u === uzanti);
  return ters?.[0] || "application/octet-stream";
}

async function supabaseFisKaydet(
  buffer: Buffer,
  dosyaAdi: string,
  uzanti: string
): Promise<{ yol: string } | { hata: string }> {
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(FIS_BUCKET).upload(dosyaAdi, buffer, {
    contentType: mimeBul(uzanti),
    upsert: false,
  });
  if (error) {
    return { hata: `Fiş yüklenemedi: ${error.message}` };
  }
  const { data } = sb.storage.from(FIS_BUCKET).getPublicUrl(dosyaAdi);
  return { yol: data.publicUrl };
}

export async function fisKaydet(
  dosya: File | null
): Promise<{ yol: string } | { hata: string } | null> {
  if (!dosya || dosya.size === 0) return null;

  if (dosya.size > MAX_FIS_BOYUT) {
    return { hata: "Fiş resmi en fazla 8 MB olabilir." };
  }

  const uzanti = uzantiBul(dosya);
  if (!uzanti) {
    return { hata: "Sadece JPG, PNG, WEBP veya HEIC fiş resmi yüklenebilir." };
  }

  const dosyaAdi = `${Date.now()}-${randomUUID().slice(0, 8)}${uzanti}`;
  const buffer = Buffer.from(await dosya.arrayBuffer());

  if (supabaseHazirMi()) {
    const sbSonuc = await supabaseFisKaydet(buffer, dosyaAdi, uzanti);
    if (!("hata" in sbSonuc)) return sbSonuc;
    // JWT / yetki hatasında yerel kayda düş — gider formu kilitlenmesin
    const mesaj = sbSonuc.hata.toLowerCase();
    if (
      mesaj.includes("jws") ||
      mesaj.includes("jwt") ||
      mesaj.includes("signature") ||
      mesaj.includes("unauthorized") ||
      mesaj.includes("anahtar")
    ) {
      console.warn("[fis] supabase başarısız, yerel kayıt:", sbSonuc.hata);
    } else {
      return sbSonuc;
    }
  }

  // Yerel fallback (Supabase yok / JWT bozuk)
  const klasor = uploadDir();
  await mkdir(klasor, { recursive: true });
  await writeFile(path.join(klasor, dosyaAdi), buffer);
  return { yol: `/uploads/${dosyaAdi}` };
}

export async function fisSil(yol: string | null | undefined): Promise<void> {
  if (!yol) return;

  if (yol.startsWith("http://") || yol.startsWith("https://")) {
    if (!supabaseHazirMi()) return;
    try {
      const url = new URL(yol);
      const isaret = `/object/public/${FIS_BUCKET}/`;
      const idx = url.pathname.indexOf(isaret);
      if (idx === -1) return;
      const dosyaAdi = decodeURIComponent(url.pathname.slice(idx + isaret.length));
      if (!dosyaAdi || dosyaAdi.includes("..")) return;
      await supabaseAdmin().storage.from(FIS_BUCKET).remove([dosyaAdi]);
    } catch {
      // yoksa sorun değil
    }
    return;
  }

  if (!yol.startsWith("/uploads/")) return;
  const dosyaAdi = path.basename(yol);
  if (!dosyaAdi || dosyaAdi.includes("..")) return;
  try {
    await unlink(path.join(uploadDir(), dosyaAdi));
  } catch {
    // Dosya yoksa sorun değil
  }
}

/** ZIP için fiş baytlarını oku (Supabase URL veya yerel dosya). */
export async function fisBaytOku(
  yol: string
): Promise<{ veri: Buffer; uzanti: string } | null> {
  if (yol.startsWith("http://") || yol.startsWith("https://")) {
    try {
      const yanit = await fetch(yol);
      if (!yanit.ok) return null;
      const veri = Buffer.from(await yanit.arrayBuffer());
      const uzanti = path.extname(new URL(yol).pathname) || ".jpg";
      return { veri, uzanti };
    } catch {
      return null;
    }
  }

  if (!yol.startsWith("/uploads/")) return null;
  const dosyaAdi = path.basename(yol);
  if (!dosyaAdi || dosyaAdi.includes("..")) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const veri = await readFile(path.join(uploadDir(), dosyaAdi));
    return { veri, uzanti: path.extname(dosyaAdi) || ".jpg" };
  } catch {
    return null;
  }
}
