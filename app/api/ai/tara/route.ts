import { revalidatePath } from "next/cache";
import { cronAnahtariGecerliMi, cronAnahtariVarMi } from "@/lib/cronGuvenlik";
import { kaynaklariTara } from "@/lib/kaynaklar/tarama";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function calistir(request: Request) {
  if (!cronAnahtariVarMi()) {
    return Response.json(
      { hata: "AI_CRON_SECRET tanımlı değil." },
      { status: 503 }
    );
  }
  if (!cronAnahtariGecerliMi(request)) {
    return Response.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  const limit = Number(new URL(request.url).searchParams.get("limit") || 2);

  try {
    const rapor = await kaynaklariTara(Number.isFinite(limit) ? limit : 2);
    if (rapor.yeniIlan > 0) {
      revalidatePath("/ai/yukler");
      revalidatePath("/ai/donus");
      revalidatePath("/");
    }
    return Response.json(rapor);
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Tarama başarısız.";
    console.error("[ai-tara]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return calistir(request);
}

export async function POST(request: Request) {
  return calistir(request);
}
