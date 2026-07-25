import { revalidatePath } from "next/cache";
import { cronKontrol } from "@/lib/cronGuvenlik";
import { kuyrugaBakim, kuyrugunuCoz } from "@/lib/kaynaklar/telegramUye";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ham mesaj kuyruğunu AI ile çözümler.
 * Okuma işinden ayrı tutulur; böylece her iki taraf da kısa sürer.
 */
async function calistir(request: Request) {
  const engel = cronKontrol(request);
  if (engel) return engel;

  const limit = Number(new URL(request.url).searchParams.get("limit") || 10);

  try {
    const rapor = await kuyrugunuCoz(Number.isFinite(limit) ? limit : 10);
    if (rapor.yeniIlan > 0) {
      revalidatePath("/ai/yukler");
      revalidatePath("/ai/donus");
      revalidatePath("/ai");
      revalidatePath("/");
    }
    // Kuyruk boşaldığında eski kayıtları temizle.
    if (rapor.kalan === 0) await kuyrugaBakim();
    return Response.json(rapor);
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Kuyruk işlenemedi.";
    console.error("[ai-kuyruk]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return calistir(request);
}

export async function POST(request: Request) {
  return calistir(request);
}
