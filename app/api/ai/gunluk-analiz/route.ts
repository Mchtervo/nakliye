import { revalidatePath } from "next/cache";
import { cronAnahtariGecerliMi, cronAnahtariVarMi } from "@/lib/cronGuvenlik";
import { bilgiBildir } from "@/lib/bildirim/gonder";
import { gunlukAnaliziUret } from "@/lib/ai/gunlukAnaliz";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!cronAnahtariVarMi()) {
    return Response.json(
      { hata: "AI_CRON_SECRET tanımlı değil." },
      { status: 503 }
    );
  }
  if (!cronAnahtariGecerliMi(request)) {
    return Response.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  try {
    const analiz = await gunlukAnaliziUret(false);
    await bilgiBildir(analiz.baslik, analiz.metin, "/ai/analiz");
    revalidatePath("/ai/analiz");
    return Response.json({ baslik: analiz.baslik, uzunluk: analiz.metin.length });
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Analiz üretilemedi.";
    console.error("[gunluk-analiz]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}
