import { revalidatePath } from "next/cache";
import { cronKontrol } from "@/lib/cronGuvenlik";
import {
  katilimSonuclariniIsle,
  type KatilmaSonucu,
} from "@/lib/kaynaklar/telegramUye";

export const dynamic = "force-dynamic";

function sonuclariAyikla(govde: { sonuclar?: unknown }): KatilmaSonucu[] {
  if (!Array.isArray(govde.sonuclar)) return [];

  return govde.sonuclar
    .map((ham) => {
      const kayit = (ham ?? {}) as Record<string, unknown>;
      return {
        chatId: String(kayit.chatId ?? "").trim(),
        katildi: kayit.katildi === true,
        hata: typeof kayit.hata === "string" ? kayit.hata : null,
      };
    })
    .filter((s) => s.chatId)
    .slice(0, 50);
}

/** Katılım denemelerinin sonucunu kaydeder. */
export async function POST(request: Request) {
  const engel = cronKontrol(request);
  if (engel) return engel;

  let govde: { sonuclar?: unknown };
  try {
    govde = (await request.json()) as { sonuclar?: unknown };
  } catch {
    return Response.json({ hata: "Geçersiz gövde." }, { status: 400 });
  }

  try {
    const rapor = await katilimSonuclariniIsle(sonuclariAyikla(govde));
    if (rapor.katilan > 0) revalidatePath("/ayarlar");
    return Response.json(rapor);
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Sonuç işlenemedi.";
    console.error("[telegram-uye-grup]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}
