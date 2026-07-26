import { prisma } from "@/lib/prisma";
import {
  aiTestArkaPlandaBaslat,
  testDurumOku,
} from "@/lib/ai/testOnMesaj";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET — test durumu + son çağrı (panel “takıldı mı?” görsün). */
export async function GET() {
  const durum = await testDurumOku();
  const son = await prisma.aiCagri.findFirst({
    orderBy: { zaman: "desc" },
    select: {
      kaynak: true,
      zaman: true,
      ciktiToken: true,
      maliyetMikro: true,
      basarili: true,
    },
  });
  return Response.json({
    ...durum,
    sonCagri: son
      ? {
          kaynak: son.kaynak,
          snOnce: Math.max(
            0,
            Math.floor((Date.now() - son.zaman.getTime()) / 1000)
          ),
          ciktiToken: son.ciktiToken,
          basarili: son.basarili,
        }
      : null,
  });
}

/**
 * POST — testi arka planda başlat, hemen 202 dön.
 * ?durdur=1 → takılan testi öldür (panel / curl).
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("durdur") === "1") {
    const { spawnSync } = await import("node:child_process");
    spawnSync("npm", ["run", "ai:test-durdur"], {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
    });
    return Response.json({ ok: true, durum: "durduruldu" });
  }

  const baslat = await aiTestArkaPlandaBaslat();
  if (!baslat.ok) {
    return Response.json({ hata: baslat.hata }, { status: 409 });
  }
  return Response.json({ ok: true, durum: "calisiyor" }, { status: 202 });
}

/** DELETE — takılan testi durdur. */
export async function DELETE() {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("npm", ["run", "ai:test-durdur"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
  return Response.json({
    ok: true,
    stdout: (r.stdout || "").slice(0, 500),
    stderr: (r.stderr || "").slice(0, 300),
  });
}
