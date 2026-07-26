import { yukIlanlariniBildir } from "@/lib/bildirim/gonder";
import { aiTercihleriOku } from "@/lib/ayarlar";
import { ilgilileriSuz } from "@/lib/kaynaklar/filtre";
import {
  telegramGuncellemeIsle,
  type TelegramGuncelleme,
} from "@/lib/kaynaklar/telegram";

export const dynamic = "force-dynamic";

/**
 * Telegram bu uca POST atar. Doğrulama, setWebhook sırasında verilen
 * secret_token başlığıyla yapılır (oturum çerezi gelmez).
 */
export async function POST(request: Request) {
  const gizli = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!gizli) {
    return Response.json(
      { hata: "TELEGRAM_WEBHOOK_SECRET tanımlı değil." },
      { status: 503 }
    );
  }

  const gelen = request.headers.get("x-telegram-bot-api-secret-token");
  if (gelen !== gizli) {
    return Response.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  let guncelleme: TelegramGuncelleme;
  try {
    guncelleme = (await request.json()) as TelegramGuncelleme;
  } catch {
    // Telegram hatalı gövdeyi tekrar tekrar gönderir; 200 dönüp geçiyoruz.
    return Response.json({ ok: true });
  }

  try {
    const sonuc = await telegramGuncellemeIsle(guncelleme);
    if (sonuc.yeniIlanlar.length > 0) {
      const tercih = await aiTercihleriOku();
      const bildirilecek = ilgilileriSuz(sonuc.yeniIlanlar, tercih);
      if (bildirilecek.length > 0) {
        await yukIlanlariniBildir(bildirilecek);
      }
    }
  } catch (hata) {
    console.error("[telegram-webhook]", hata);
  }

  // Telegram'a her zaman 200 dönülür, aksi halde aynı güncellemeyi yineler.
  return Response.json({ ok: true });
}
