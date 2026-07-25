import { cronKontrol } from "@/lib/cronGuvenlik";
import {
  adaylariDegerlendir,
  kesifGoreviUret,
  type BulunanGrup,
} from "@/lib/kaynaklar/telegramUye";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Bu turda denenecek arama sorguları ve kalan katılım hakkı. */
export async function GET(request: Request) {
  const engel = cronKontrol(request);
  if (engel) return engel;

  try {
    return Response.json(await kesifGoreviUret());
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Keşif hazırlanamadı.";
    console.error("[telegram-uye-kesif]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}

function adaylariAyikla(govde: { adaylar?: unknown }): BulunanGrup[] {
  if (!Array.isArray(govde.adaylar)) return [];

  return govde.adaylar
    .map((ham) => {
      const kayit = (ham ?? {}) as Record<string, unknown>;
      return {
        chatId: String(kayit.chatId ?? "").trim(),
        baslik: String(kayit.baslik ?? "").trim(),
        kullaniciAdi:
          typeof kayit.kullaniciAdi === "string" ? kayit.kullaniciAdi : null,
        uyeSayisi: Number.isFinite(Number(kayit.uyeSayisi))
          ? Number(kayit.uyeSayisi)
          : null,
        uye: kayit.uye === true,
      };
    })
    .filter((a) => a.chatId && a.baslik)
    .slice(0, 500);
}

/** Bulunan grupları değerlendirir, katılınacakların listesini döner. */
export async function POST(request: Request) {
  const engel = cronKontrol(request);
  if (engel) return engel;

  let govde: { adaylar?: unknown };
  try {
    govde = (await request.json()) as { adaylar?: unknown };
  } catch {
    return Response.json({ hata: "Geçersiz gövde." }, { status: 400 });
  }

  try {
    return Response.json(await adaylariDegerlendir(adaylariAyikla(govde)));
  } catch (hata) {
    const mesaj =
      hata instanceof Error ? hata.message : "Adaylar değerlendirilemedi.";
    console.error("[telegram-uye-kesif]", mesaj);
    return Response.json({ hata: mesaj }, { status: 500 });
  }
}
