import { cronKontrol } from "@/lib/cronGuvenlik";
import { okumaGoreviUret } from "@/lib/kaynaklar/telegramUye";

export const dynamic = "force-dynamic";

/** Tarayıcı fonksiyona "hangi grupları, nereden itibaren oku" der. */
export async function GET(request: Request) {
  const engel = cronKontrol(request);
  if (engel) return engel;

  const limit = Number(new URL(request.url).searchParams.get("limit") || 5);

  try {
    const gorev = await okumaGoreviUret(Number.isFinite(limit) ? limit : 5);
    return Response.json(gorev);
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Görev üretilemedi.";
    console.error("[telegram-uye-gorev]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}
