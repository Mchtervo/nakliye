import { NextResponse } from "next/server";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { uploadDir } from "@/lib/yollar";
import { cookies } from "next/headers";
import { GORUNUM_COOKIE, OTURUM_COOKIE, etkinOturum } from "@/lib/auth";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/** DATA_DIR kullanıldığında public dışında kalan fişleri servis eder. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ dosya: string }> }
) {
  // Yöneticinin fişleri: yalnız yönetici oturumu (üye ve oturumsuz istek açamaz)
  const jar = await cookies();
  const o = await etkinOturum(jar.get(OTURUM_COOKIE)?.value, jar.get(GORUNUM_COOKIE)?.value);
  if (o?.rol !== "admin") return new NextResponse("Bulunamadı", { status: 404 });

  const { dosya } = await ctx.params;
  const ad = path.basename(dosya || "");
  if (!ad || ad.includes("..") || ad === ".gitkeep") {
    return new NextResponse("Bulunamadı", { status: 404 });
  }

  const tamYol = path.join(uploadDir(), ad);
  try {
    await access(tamYol);
  } catch {
    return new NextResponse("Bulunamadı", { status: 404 });
  }

  const veri = await readFile(tamYol);
  const uzanti = path.extname(ad).toLowerCase();
  return new NextResponse(veri, {
    status: 200,
    headers: {
      "Content-Type": MIME[uzanti] || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
