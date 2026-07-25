import type { Config } from "@netlify/functions";
import { Api, TelegramClient, utils } from "telegram";
import { StringSession } from "telegram/sessions";

/**
 * Kullanıcının kendi Telegram hesabıyla çalışır.
 *
 * Her koşuda:
 *  1. Takip edilen gruplardan yeni mesajları okur ve uygulamaya kuyruğa atar.
 *  2. Keşif penceresi açıksa: zaten üye olunan uygun grupları takibe alır,
 *     global aramayla yeni gruplar bulur ve kotanın izin verdiği kadarına katılır.
 *
 * Zamanlanmış fonksiyon sınırı 30 saniye; bütün adımlar bütçeyle korunur.
 */

const BUTCE_MS = 24_000;
const KATILIM_BEKLEME_MS = 3_000;

type OkumaGorevi = {
  aktif: boolean;
  ilkOkumaAdedi: number;
  gruplar: { id: number; chatId: string; sonMesajId: number | null }[];
};

type KesifGorevi = {
  aktif: boolean;
  sorgular: string[];
  kalanKatilim: number;
};

type KatilmaEmri = {
  chatId: string;
  kullaniciAdi: string | null;
  baslik: string;
};

type Aday = {
  chatId: string;
  baslik: string;
  kullaniciAdi: string | null;
  uyeSayisi: number | null;
  uye: boolean;
};

function bekle(ms: number): Promise<void> {
  return new Promise((c) => setTimeout(c, ms));
}

function ortam() {
  const kok = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(
    /\/$/,
    ""
  );
  return {
    kok,
    anahtar: process.env.AI_CRON_SECRET || "",
    apiId: Number(process.env.TELEGRAM_API_ID),
    apiHash: process.env.TELEGRAM_API_HASH || "",
    oturum: process.env.TELEGRAM_SESSION || "",
  };
}

async function uygulama<T>(
  yol: string,
  secenek: { govde?: unknown } = {}
): Promise<T> {
  const { kok, anahtar } = ortam();
  const cevap = await fetch(`${kok}${yol}`, {
    method: secenek.govde ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${anahtar}`,
      ...(secenek.govde ? { "Content-Type": "application/json" } : {}),
    },
    body: secenek.govde ? JSON.stringify(secenek.govde) : undefined,
  });

  if (!cevap.ok) {
    throw new Error(`${yol} -> ${cevap.status} ${await cevap.text()}`);
  }
  return (await cevap.json()) as T;
}

/** Grup / kanal olan sohbetleri aday biçimine çevirir. */
function sohbetiAdayaCevir(sohbet: Api.TypeChat, uye: boolean): Aday | null {
  if (sohbet instanceof Api.Channel) {
    // Yayın kanalları da yük ilanı paylaşıyor; ikisini de alıyoruz.
    if (sohbet.left && uye) return null;
    return {
      chatId: utils.getPeerId(sohbet),
      baslik: sohbet.title || "",
      kullaniciAdi: sohbet.username || null,
      uyeSayisi: sohbet.participantsCount ?? null,
      uye,
    };
  }
  if (sohbet instanceof Api.Chat && uye) {
    return {
      chatId: utils.getPeerId(sohbet),
      baslik: sohbet.title || "",
      kullaniciAdi: null,
      uyeSayisi: sohbet.participantsCount ?? null,
      uye: true,
    };
  }
  return null;
}

async function gruplariOku(
  istemci: TelegramClient,
  gorev: OkumaGorevi,
  bitis: number
) {
  const gonderilecek: {
    id: number;
    sonMesajId: number | null;
    mesajlar: { mesajId: number; metin: string }[];
    hata?: string;
  }[] = [];

  for (const grup of gorev.gruplar) {
    if (Date.now() > bitis) break;

    try {
      const varlik = await istemci.getEntity(grup.chatId);
      const mesajlar = await istemci.getMessages(varlik, {
        limit: grup.sonMesajId ? 100 : gorev.ilkOkumaAdedi,
        ...(grup.sonMesajId ? { minId: grup.sonMesajId } : {}),
      });

      const metinler = mesajlar
        .filter((m) => typeof m.message === "string" && m.message.trim())
        .map((m) => ({ mesajId: m.id, metin: m.message as string }));

      const enBuyuk = mesajlar.reduce((s, m) => (m.id > s ? m.id : s), 0);

      gonderilecek.push({
        id: grup.id,
        sonMesajId: enBuyuk > 0 ? enBuyuk : grup.sonMesajId,
        mesajlar: metinler,
      });
    } catch (hata) {
      // Hatalı grup da bildirilir; yoksa sıranın başında takılı kalır.
      const mesaj = hata instanceof Error ? hata.message : "Grup okunamadı";
      console.warn("[telegram-uye] grup okunamadı", grup.chatId, mesaj);
      gonderilecek.push({
        id: grup.id,
        sonMesajId: grup.sonMesajId,
        mesajlar: [],
        hata: mesaj,
      });
    }
  }

  if (gonderilecek.length === 0) return null;
  return uygulama<{ alinan: number; kuyruga: number; grup: number }>(
    "/api/telegram/uye/mesajlar",
    { govde: { gruplar: gonderilecek } }
  );
}

async function kesfet(
  istemci: TelegramClient,
  kesif: KesifGorevi,
  mevcutSohbetler: Api.TypeChat[],
  bitis: number
) {
  const adaylar: Aday[] = [];
  const varliklar = new Map<string, Api.TypeChat>();

  // 1) Hesabın zaten üye olduğu gruplar: katılmaya gerek yok.
  for (const sohbet of mevcutSohbetler) {
    const aday = sohbetiAdayaCevir(sohbet, true);
    if (aday?.baslik) {
      adaylar.push(aday);
      varliklar.set(aday.chatId, sohbet);
    }
  }

  // 2) Global aramayla yeni gruplar.
  for (const sorgu of kesif.sorgular) {
    if (Date.now() > bitis) break;
    try {
      const sonuc = await istemci.invoke(
        new Api.contacts.Search({ q: sorgu, limit: 50 })
      );
      for (const sohbet of sonuc.chats) {
        const aday = sohbetiAdayaCevir(sohbet, false);
        if (aday?.baslik) {
          adaylar.push(aday);
          varliklar.set(aday.chatId, sohbet);
        }
      }
    } catch (hata) {
      console.warn(
        "[telegram-uye] arama başarısız",
        sorgu,
        hata instanceof Error ? hata.message : hata
      );
    }
  }

  if (adaylar.length === 0) return null;

  const karar = await uygulama<{
    yeniAday: number;
    hazirUyelik: number;
    elenen: number;
    katil: KatilmaEmri[];
  }>("/api/telegram/uye/kesif", { govde: { adaylar } });

  const sonuclar: { chatId: string; katildi: boolean; hata?: string }[] = [];

  for (const emir of karar.katil) {
    if (Date.now() > bitis) break;

    const hedef =
      varliklar.get(emir.chatId) ?? emir.kullaniciAdi ?? emir.chatId;
    try {
      await istemci.invoke(new Api.channels.JoinChannel({ channel: hedef }));
      sonuclar.push({ chatId: emir.chatId, katildi: true });
      console.log("[telegram-uye] katılındı:", emir.baslik);
    } catch (hata) {
      sonuclar.push({
        chatId: emir.chatId,
        katildi: false,
        hata: hata instanceof Error ? hata.message : "Katılınamadı",
      });
    }
    // Arka arkaya katılım hesabı riske atar; araya bekleme konur.
    await bekle(KATILIM_BEKLEME_MS);
  }

  if (sonuclar.length > 0) {
    await uygulama("/api/telegram/uye/grup", { govde: { sonuclar } });
  }

  return { ...karar, katilan: sonuclar.filter((s) => s.katildi).length };
}

export default async function handler(): Promise<Response> {
  const { kok, anahtar, apiId, apiHash, oturum } = ortam();

  if (!kok || !anahtar) {
    console.warn("[telegram-uye] URL veya AI_CRON_SECRET eksik, atlandı.");
    return new Response("eksik yapilandirma", { status: 200 });
  }
  if (!Number.isInteger(apiId) || !apiHash || !oturum) {
    console.log("[telegram-uye] Telegram hesabı bağlı değil, atlandı.");
    return new Response("hesap yok", { status: 200 });
  }

  const bitis = Date.now() + BUTCE_MS;
  let istemci: TelegramClient | null = null;

  try {
    const gorev = await uygulama<OkumaGorevi>(
      "/api/telegram/uye/gorev?limit=6"
    );
    const kesif = await uygulama<KesifGorevi>("/api/telegram/uye/kesif");

    if (!gorev.aktif) {
      console.log("[telegram-uye] Modül kapalı.");
      return new Response("kapali", { status: 200 });
    }
    if (gorev.gruplar.length === 0 && kesif.sorgular.length === 0) {
      return new Response("is yok", { status: 200 });
    }

    istemci = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
      connectionRetries: 2,
      requestRetries: 2,
      autoReconnect: false,
    });
    await istemci.connect();

    // Grup kimliklerini çözebilmek için sohbet listesi bir kez çekilir.
    const sohbetler = await istemci.getDialogs({ limit: 200 });
    const gruplar = sohbetler
      .filter((d) => d.isGroup || d.isChannel)
      .map((d) => d.entity)
      .filter((e): e is Api.TypeChat => Boolean(e));

    const okuma = await gruplariOku(istemci, gorev, bitis);
    if (okuma) console.log("[telegram-uye] okuma", JSON.stringify(okuma));

    if (kesif.sorgular.length > 0 && Date.now() < bitis) {
      const sonuc = await kesfet(istemci, kesif, gruplar, bitis);
      if (sonuc) console.log("[telegram-uye] keşif", JSON.stringify(sonuc));
    }

    return new Response("ok", { status: 200 });
  } catch (hata) {
    console.error(
      "[telegram-uye]",
      hata instanceof Error ? hata.message : hata
    );
    return new Response("hata", { status: 200 });
  } finally {
    await istemci?.disconnect().catch(() => null);
    await istemci?.destroy().catch(() => null);
  }
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
