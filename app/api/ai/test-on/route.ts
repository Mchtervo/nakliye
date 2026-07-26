import {
  aiTestArkaPlandaBaslat,
  testDurumOku,
} from "@/lib/ai/testOnMesaj";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET — test durumu (panel poll). Oturum middleware'den gelir. */
export async function GET() {
  const durum = await testDurumOku();
  return Response.json(durum);
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
