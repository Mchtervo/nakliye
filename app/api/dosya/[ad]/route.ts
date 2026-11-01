import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { uyeDosyaYolu } from "@/lib/fis";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/** Üyenin kendi fişi: yalnız o üyenin oturumuyla, yalnız kendi klasöründen. */
export async function GET(_req: Request, ctx: { params: Promise<{ ad: string }> }) {
  const { ad } = await ctx.params;
  const tam = await uyeDosyaYolu(ad);
  if (!tam) return new NextResponse("Bulunamadı", { status: 404 });
  try {
    const veri = await readFile(tam);
    return new NextResponse(veri, {
      headers: {
        "Content-Type": MIME[path.extname(tam).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Bulunamadı", { status: 404 });
  }
}
