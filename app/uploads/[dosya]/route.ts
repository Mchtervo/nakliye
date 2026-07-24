import { NextResponse } from "next/server";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { uploadDir } from "@/lib/yollar";

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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
