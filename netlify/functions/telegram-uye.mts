import type { Config } from "@netlify/functions";
import { Api, TelegramClient, utils } from "telegram";
// Klasör içe aktarımı ESM'de çalışmıyor; dosyayı doğrudan göstermek gerekiyor.
import { StringSession } from "telegram/sessions/index.js";

/**
 * Kullanıcının kendi Telegram hesabıyla çalışır.
 *
 * Her koşuda:
 *  1. Takip edilen gruplardan yeni mesajları okur ve uygulamaya kuyruğa atar.
 *  2. Üye olunan grupları uygulamaya bildirir; uygun olanlar takibe alınır,
 *     elle katılınan aday gruplar otomatik takibe geçer.
 *  3. Arama penceresi açıksa (6 saatte bir) yeni grupları arar ve aday
 *     olarak kaydettirir.
 *
 * Gruba katılma bilinçli olarak yapılmaz; katılım kararı kullanıcınındır.
 * Zamanlanmış fonksiyon sınırı 30 saniye; bütün adımlar bütçeyle korunur.
 */

const BUTCE_MS = 24_000;

type OkumaGorevi = {
  aktif: boolean;
  ilkOkumaAdedi: number;
  gruplar: {
    id: number;
    chatId: string;
    kullaniciAdi: string | null;
    sonMesajId: number | null;
  }[];
};

type KesifGorevi = {
  aktif: boolean;
  sorgular: string[];
  /** ADAY kalmış, username'i olan gruplar — üyelik yeniden doğrulanır. */
  adayKontrol: { chatId: string; kullaniciAdi: string; baslik: string }[];
};

type Aday = {
  chatId: string;
  baslik: string;
  kullaniciAdi: string | null;
  uyeSayisi: number | null;
  uye: boolean;
};

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

/**
 * Grup / kanal olan sohbetleri aday biçimine çevirir.
 * Sohbet listesinden gelenler üyedir; aramadan gelenlerde üyelik sadece
 * `left` alanı kesin olarak false ise varsayılır.
 */
function sohbetiAdayaCevir(
  sohbet: Api.TypeChat,
  dialogdan: boolean
): Aday | null {
  const uyeMi = (ayrilmis: boolean | undefined) =>
    dialogdan ? ayrilmis !== true : ayrilmis === false;

  // Yayın kanalları da yük ilanı paylaşıyor; grup ve kanalı birlikte alıyoruz.
  if (sohbet instanceof Api.Channel) {
    const uye = uyeMi(sohbet.left);
    if (dialogdan && !uye) return null;
    return {
      chatId: utils.getPeerId(sohbet),
      baslik: sohbet.title || "",
      kullaniciAdi: sohbet.username || null,
      uyeSayisi: sohbet.participantsCount ?? null,
      uye,
    };
  }

  // Temel gruplara aramayla ulaşılamaz; sadece üye olunanlar işe yarar.
  if (sohbet instanceof Api.Chat && dialogdan && uyeMi(sohbet.left)) {
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
  bitis: number,
  /** peerId → dialog entity (getEntity(chatId) bazen cache'siz patlar). */
  entityHaritasi: Map<string, Api.TypeChat>
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
      let varlik: Api.TypeChat | null =
        entityHaritasi.get(String(grup.chatId)) ?? null;

      // Dialogda yoksa önce @username, sonra chatId.
      if (!varlik && grup.kullaniciAdi) {
        try {
          varlik = (await istemci.getEntity(grup.kullaniciAdi)) as Api.TypeChat;
        } catch {
          varlik = null;
        }
      }
      if (!varlik) {
        try {
          varlik = (await istemci.getEntity(grup.chatId)) as Api.TypeChat;
        } catch {
          varlik = null;
        }
      }

      if (!varlik) {
        gonderilecek.push({
          id: grup.id,
          sonMesajId: grup.sonMesajId,
          mesajlar: [],
          hata: "Could not find the input entity (dialogda yok)",
        });
        continue;
      }

      // Gruptan çıkılmış kanal.
      if (varlik instanceof Api.Channel && varlik.left === true) {
        gonderilecek.push({
          id: grup.id,
          sonMesajId: grup.sonMesajId,
          mesajlar: [],
          hata: "Gruptan ayrılmış (left=true)",
        });
        continue;
      }

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

/**
 * Dialog listesi kesildiyse ADAY'da kalan üyelikler kaçmasın diye
 * username ile entity çekip left!==true ise üye say.
 */
async function adayUyelikleriniDogrula(
  istemci: TelegramClient,
  adaylar: { chatId: string; kullaniciAdi: string; baslik: string }[],
  bitis: number
): Promise<Aday[]> {
  const bulunan: Aday[] = [];
  for (const a of adaylar.slice(0, 40)) {
    if (Date.now() > bitis) break;
    if (!a.kullaniciAdi) continue;
    try {
      const varlik = await istemci.getEntity(a.kullaniciAdi);
      if (!(varlik instanceof Api.Channel)) continue;
      if (varlik.left === true) continue;
      bulunan.push({
        chatId: utils.getPeerId(varlik),
        baslik: varlik.title || a.baslik,
        kullaniciAdi: varlik.username || a.kullaniciAdi,
        uyeSayisi: varlik.participantsCount ?? null,
        uye: true,
      });
    } catch (hata) {
      console.warn(
        "[telegram-uye] aday üyelik",
        a.kullaniciAdi,
        hata instanceof Error ? hata.message : hata
      );
    }
  }
  return bulunan;
}

async function kesfet(
  istemci: TelegramClient,
  sorgular: string[],
  mevcutSohbetler: Api.TypeChat[],
  bitis: number,
  ekstraUyeler: Aday[] = []
) {
  const adaylar: Aday[] = [...ekstraUyeler];

  // 1) Üye olunan gruplar: uygun olanlar takibe alınır, elle katılınan
  //    aday gruplar burada otomatik takibe geçer.
  for (const sohbet of mevcutSohbetler) {
    const aday = sohbetiAdayaCevir(sohbet, true);
    if (aday?.baslik) adaylar.push(aday);
  }

  // 2) Arama penceresi açıksa yeni gruplar aday olarak kaydedilir.
  for (const sorgu of sorgular) {
    if (Date.now() > bitis) break;
    try {
      const sonuc = await istemci.invoke(
        new Api.contacts.Search({ q: sorgu, limit: 50 })
      );
      for (const sohbet of sonuc.chats) {
        const aday = sohbetiAdayaCevir(sohbet, false);
        if (aday?.baslik) adaylar.push(aday);
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

  return uygulama<{
    yeniAday: number;
    hazirUyelik: number;
    terfi: number;
    elenen: number;
  }>("/api/telegram/uye/kesif", { govde: { adaylar } });
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

    if (!gorev.aktif || !kesif.aktif) {
      console.log("[telegram-uye] Modül kapalı.");
      return new Response("kapali", { status: 200 });
    }

    istemci = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
      connectionRetries: 2,
      requestRetries: 2,
      autoReconnect: false,
    });
    await istemci.connect();

    // Sohbet listesi: 200 yetmeyebiliyor (eski üyelikler listede geride kalır).
    // 1000'e çıkar + ADAY username ile üyelik doğrulaması (aşağıda).
    const sohbetler = await istemci.getDialogs({ limit: 1000 });
    const gruplar = sohbetler
      .filter((d) => d.isGroup || d.isChannel)
      .map((d) => d.entity)
      .filter((e): e is Api.TypeChat => Boolean(e));
    const entityHaritasi = new Map<string, Api.TypeChat>();
    for (const e of gruplar) {
      try {
        entityHaritasi.set(utils.getPeerId(e), e);
      } catch {
        /* yok say */
      }
    }
    console.log(
      "[telegram-uye] dialog",
      sohbetler.length,
      "grup/kanal",
      gruplar.length
    );

    const okuma = await gruplariOku(istemci, gorev, bitis, entityHaritasi);
    if (okuma) console.log("[telegram-uye] okuma", JSON.stringify(okuma));

    // Üyelik senkronu her koşuda: elle katıldığın grup 5 dakikada devreye girer.
    if (Date.now() < bitis) {
      // ADAY'da kalmış ama aslında üye olunanları (dialog kesildiyse) yakala.
      const adayUyeler = await adayUyelikleriniDogrula(
        istemci,
        kesif.adayKontrol || [],
        bitis
      );
      const sonuc = await kesfet(
        istemci,
        kesif.sorgular,
        gruplar,
        bitis,
        adayUyeler
      );
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

// VPS GramJS daemon + crontab'a taşındı — Netlify schedule kapalı.
export const config: Config = {};
