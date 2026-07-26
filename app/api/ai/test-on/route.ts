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
 * Sayfa 60–120 sn timeout'ta düşmesin diye server action kullanılmaz.
 */
export async function POST() {
  const baslat = await aiTestArkaPlandaBaslat();
  if (!baslat.ok) {
    return Response.json({ hata: baslat.hata }, { status: 409 });
  }
  return Response.json({ ok: true, durum: "calisiyor" }, { status: 202 });
}
