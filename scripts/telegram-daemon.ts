/**
 * Sürekli GramJS okuyucu — olay tabanlı (NewMessage), polling yok.
 * Ön filtre / satır hash: mesajlariKuyrugaAl (OpenAI çağırmaz).
 *
 * Çalıştırma (VPS):
 *   npm run telegram:daemon
 * systemd: deploy/yukavci-telegram.service
 */
import { TelegramClient, utils, Api, errors } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage, type NewMessageEvent } from "telegram/events/index.js";
import { prisma } from "@/lib/prisma";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { telegramGonder } from "@/lib/bildirim/telegram";
import {
  ILK_OKUMA_ADEDI,
  TELEGRAM_UYE,
  mesajlariKuyrugaAl,
} from "@/lib/kaynaklar/telegramUye";

const SAGLIK_ESIK_MS = 30 * 60 * 1000;
const SAGLIK_KONTROL_MS = 60 * 1000;
const KAYNAK_YENILE_MS = 5 * 60 * 1000;
const UYARI_SOGUK_MS = 30 * 60 * 1000;

type Kaynak = {
  id: number;
  chatId: string;
  kullaniciAdi: string | null;
  sonMesajId: number | null;
  ad: string;
};

let sonAktivite = Date.now();
let sonUyari = 0;
let istemci: TelegramClient | null = null;
/** peerId string → kaynak */
const kaynaklar = new Map<string, Kaynak>();

function log(...args: unknown[]) {
  const ts = new Date().toISOString();
  console.log(`[telegram-daemon ${ts}]`, ...args);
}

function uyari(...args: unknown[]) {
  const ts = new Date().toISOString();
  console.warn(`[telegram-daemon ${ts}]`, ...args);
}

function ortamKontrol() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || "";
  const oturum = process.env.TELEGRAM_SESSION || "";
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
    throw new Error("TELEGRAM_API_ID / TELEGRAM_API_HASH eksik (.env)");
  }
  if (!oturum.trim()) {
    throw new Error(
      "TELEGRAM_SESSION boş. Önce: npm run telegram:oturum — çıktıyı .env'e yaz."
    );
  }
  if ((process.env.AI_KAPALI || "").trim().toLowerCase() !== "true") {
    uyari("AI_KAPALI true değil — daemon yine OpenAI çağırmaz; kuyruk yazar.");
  }
  return { apiId, apiHash, oturum };
}

function aktivite() {
  sonAktivite = Date.now();
}

function gonderenUserIdBul(msg: {
  fromId?: unknown;
  senderId?: unknown;
}): string | null {
  try {
    const raw = msg.fromId || msg.senderId;
    if (!raw) return null;
    if (typeof raw === "object" && raw !== null && "userId" in raw) {
      return String((raw as { userId: unknown }).userId);
    }
    return String(
      utils.getPeerId(raw as Parameters<typeof utils.getPeerId>[0])
    );
  } catch {
    return null;
  }
}

async function kaynaklariYukle(): Promise<number> {
  const satirlar = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, aktif: true, durum: "AKTIF" },
    select: {
      id: true,
      hedef: true,
      kullaniciAdi: true,
      sonMesajId: true,
      ad: true,
    },
  });
  kaynaklar.clear();
  for (const s of satirlar) {
    const k: Kaynak = {
      id: s.id,
      chatId: String(s.hedef),
      kullaniciAdi: s.kullaniciAdi,
      sonMesajId: s.sonMesajId,
      ad: s.ad || `grup#${s.id}`,
    };
    kaynaklar.set(k.chatId, k);
  }
  return kaynaklar.size;
}

async function saglikUyarisiGonder(sebep: string) {
  const simdi = Date.now();
  if (simdi - sonUyari < UYARI_SOGUK_MS) return;
  sonUyari = simdi;

  const chatId = await ayarOku(AYAR_ANAHTARLARI.telegramChatId);
  const metin =
    `<b>Yük Avcısı — Telegram okuyucu uyarısı</b>\n` +
    `${sebep}\n` +
    `Son aktivite: ${new Date(sonAktivite).toISOString()}\n` +
    `Takipteki grup: ${kaynaklar.size}`;

  if (!chatId) {
    uyari("Sağlık uyarısı (telegram_chat_id yok):", sebep);
    return;
  }
  const sonuc = await telegramGonder(chatId, metin);
  if (!sonuc.basarili) uyari("Sağlık uyarısı gönderilemedi:", sonuc.hata);
  else log("Sağlık uyarısı gönderildi.");
}

async function entityBul(client: TelegramClient, k: Kaynak) {
  if (k.kullaniciAdi) {
    try {
      return await client.getEntity(k.kullaniciAdi);
    } catch {
      /* chatId dene */
    }
  }
  try {
    return await client.getEntity(k.chatId);
  } catch {
    return null;
  }
}

/** Açılışta sonMesajId'den bu yana kaçan mesajları bir kez çeker. */
async function kacanlariYakala(client: TelegramClient) {
  log(`Catch-up başlıyor (${kaynaklar.size} grup)...`);
  for (const k of kaynaklar.values()) {
    try {
      const varlik = await entityBul(client, k);
      if (!varlik) {
        await mesajlariKuyrugaAl([
          {
            id: k.id,
            sonMesajId: k.sonMesajId,
            mesajlar: [],
            hata: "Could not find the input entity (dialogda yok)",
          },
        ]);
        continue;
      }
      if (varlik instanceof Api.Channel && varlik.left === true) {
        await mesajlariKuyrugaAl([
          {
            id: k.id,
            sonMesajId: k.sonMesajId,
            mesajlar: [],
            hata: "Gruptan ayrılmış (left=true)",
          },
        ]);
        continue;
      }

      const mesajlar = await client.getMessages(varlik, {
        limit: k.sonMesajId ? 80 : ILK_OKUMA_ADEDI,
        ...(k.sonMesajId ? { minId: k.sonMesajId } : {}),
      });
      const metinler = mesajlar
        .filter((m) => typeof m.message === "string" && m.message.trim())
        .map((m) => ({
          mesajId: m.id,
          metin: m.message as string,
          entities: m.entities ?? null,
          gonderenUserId: gonderenUserIdBul(m),
        }));
      const enBuyuk = mesajlar.reduce((s, m) => (m.id > s ? m.id : s), 0);

      // Catch-up hasadı
      try {
        const { mesajdanHasatEt } = await import("@/lib/kaynaklar/linkHasat");
        let hasatYeni = 0;
        for (const m of metinler) {
          const h = await mesajdanHasatEt(
            m.metin,
            { id: k.id, ad: k.ad },
            m.entities,
            istemci
          );
          hasatYeni += h.yeni;
          if (h.kisiBot > 0 || h.cozulemedi > 0) {
            log(
              `catch-up hasat filtre #${k.id}: grup=${h.grup} kisiBot=${h.kisiBot} cozulemedi=${h.cozulemedi}`
            );
          }
        }
        if (hasatYeni > 0) log(`catch-up hasat #${k.id}: +${hasatYeni}`);
      } catch (e) {
        uyari("catch-up hasat", e instanceof Error ? e.message : e);
      }

      const rapor = await mesajlariKuyrugaAl([
        {
          id: k.id,
          sonMesajId: enBuyuk > 0 ? enBuyuk : k.sonMesajId,
          mesajlar: metinler.map(({ mesajId, metin, gonderenUserId }) => ({
            mesajId,
            metin,
            gonderenUserId,
          })),
        },
      ]);
      if (enBuyuk > 0) k.sonMesajId = enBuyuk;
      if (metinler.length > 0) {
        log(
          `catch-up #${k.id}: ${metinler.length} mesaj, kuyruk +${rapor.kuyruga}`
        );
      }
    } catch (e) {
      uyari(
        "catch-up hata",
        k.chatId,
        e instanceof Error ? e.message : e
      );
    }
  }
  aktivite();
  log("Catch-up bitti.");
}

async function mesajiIsle(event: NewMessageEvent) {
  aktivite();
  const msg = event.message;
  if (!msg || typeof msg.message !== "string" || !msg.message.trim()) return;

  const metin = msg.message.trim();
  const fromUser = gonderenUserIdBul(msg);

  // Özel sohbet cevabı (gönderdiğimiz DM'e yanıt)
  try {
    const peerStr = utils.getPeerId(msg.peerId);
    const grupMu = kaynaklar.has(String(peerStr));
    if (!grupMu && fromUser) {
      const { tdmCevapIsle } = await import("@/lib/kaynaklar/telegramDm");
      const r = await tdmCevapIsle(fromUser, metin);
      if (r.islendi) {
        log(`tdm cevap user=${fromUser}`);
        return;
      }
    }
  } catch {
    /* peer parse */
  }

  let peerId: string;
  try {
    peerId = utils.getPeerId(msg.peerId);
  } catch {
    return;
  }

  const k = kaynaklar.get(String(peerId));
  if (!k) return;

  const mesajId = msg.id;
  log(`olay grup=#${k.id} msg=${mesajId} from=${fromUser || "?"} len=${metin.length}`);

  // Link hasadı — filtre öncesi; elenen mesajdaki davet de değerli.
  try {
    const { mesajdanHasatEt } = await import("@/lib/kaynaklar/linkHasat");
    const h = await mesajdanHasatEt(
      metin,
      { id: k.id, ad: k.ad },
      msg.entities ?? null,
      istemci
    );
    if (h.yeni > 0) {
      log(
        `hasat +${h.yeni} grup (mevcut=${h.mevcut} kisiBot=${h.kisiBot} cozulemedi=${h.cozulemedi})`
      );
    } else if (h.kisiBot > 0 || h.bulunan > 0) {
      log(
        `hasat yok yeni: bulunan=${h.bulunan} kisiBot=${h.kisiBot} mevcut=${h.mevcut} cozulemedi=${h.cozulemedi}`
      );
    }
  } catch (e) {
    uyari("hasat hata", e instanceof Error ? e.message : e);
  }

  try {
    const rapor = await mesajlariKuyrugaAl([
      {
        id: k.id,
        sonMesajId: mesajId,
        mesajlar: [{ mesajId, metin, gonderenUserId: fromUser }],
      },
    ]);
    k.sonMesajId = mesajId;
    if (rapor.kuyruga > 0) {
      log(`kuyruk +${rapor.kuyruga} (elenen: ${JSON.stringify(rapor.elenen)})`);
    } else if (Object.keys(rapor.elenen).length > 0) {
      log(`elenen (kuyruk yok): ${JSON.stringify(rapor.elenen)}`);
    }
  } catch (e) {
    uyari("kuyruk hata", e instanceof Error ? e.message : e);
  }
}

/** Onaylı DM kuyruğu — otomatik değil, kullanıcı [Gönder] bastıktan sonra. */
async function tdmKuyrukIsle(client: TelegramClient) {
  const {
    tdmKuyruktanAl,
    tdmGonderildiIsaretle,
    tdmHataIsaretle,
  } = await import("@/lib/kaynaklar/telegramDm");

  const aday = await tdmKuyruktanAl();
  if (!aday) return;

  try {
    const entity = await client.getInputEntity(aday.hedefUserId);
    const sent = await client.sendMessage(entity, { message: aday.metin });
    const outId =
      sent && typeof sent === "object" && "id" in sent
        ? Number((sent as { id: number }).id)
        : null;
    await tdmGonderildiIsaretle(aday.id, Number.isFinite(outId) ? outId : null);
    log(`tdm gönderildi dm=#${aday.id} → user=${aday.hedefUserId}`);
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    if (e instanceof errors.FloodWaitError) {
      const kilit = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const { ayarYaz } = await import("@/lib/ayarlar");
      await ayarYaz(AYAR_ANAHTARLARI.telegramFloodBitis, kilit.toISOString());
      await tdmHataIsaretle(aday.id, `FloodWait ${e.seconds}s`);
      const { tdmFloodBildir } = await import("@/lib/kaynaklar/telegramDm");
      await tdmFloodBildir(e.seconds).catch(() => null);
      uyari(`tdm FloodWait ${e.seconds}s → 24s kilit`);
      return;
    }
    await tdmHataIsaretle(aday.id, mesaj);
    uyari("tdm gönderim hata", mesaj);
    try {
      const chatId = await ayarOku(AYAR_ANAHTARLARI.telegramChatId);
      if (chatId) {
        await telegramGonder(
          chatId,
          `DM gönderilemedi (#${aday.ilanId}): ${mesaj.slice(0, 200)}`
        );
      }
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const { apiId, apiHash, oturum } = ortamKontrol();

  const n = await kaynaklariYukle();
  log(`Başlıyor. AKTİF grup: ${n}. AI kuyruğa yazar, OpenAI çağırmaz.`);

  istemci = new TelegramClient(new StringSession(oturum), apiId, apiHash, {
    connectionRetries: 10,
    autoReconnect: true,
    retryDelay: 2000,
  });

  await istemci.connect();
  const ben = await istemci.getMe();
  log(
    `Bağlandı: ${"firstName" in ben ? ben.firstName : ""} (@${
      "username" in ben && ben.username ? ben.username : "-"
    })`
  );
  aktivite();

  // Catch-up'tan ÖNCE dinle — restart sırasında catch-up sürerken gelen
  // canlı mesajlar kaçmasın. Çift işleme: mesajlariKuyrugaAl dedup eder.
  istemci.addEventHandler(mesajiIsle, new NewMessage({ incoming: true }));
  await kacanlariYakala(istemci);

  const tdmTimer = setInterval(() => {
    if (!istemci?.connected) return;
    tdmKuyrukIsle(istemci).catch((e) =>
      uyari("tdm kuyruk", e instanceof Error ? e.message : e)
    );
  }, 5_000);

  const cevapYokTimer = setInterval(() => {
    import("@/lib/kaynaklar/telegramDm")
      .then(({ tdmCevapYokIsle }) => tdmCevapYokIsle())
      .then((n) => {
        if (n > 0) log(`CEVAP_YOK işaretlendi: ${n}`);
      })
      .catch((e) =>
        uyari("tdm cevap yok", e instanceof Error ? e.message : e)
      );
  }, 15 * 60_000);

  const kaynakTimer = setInterval(() => {
    kaynaklariYukle()
      .then((adet) => log(`Kaynak yenilendi: ${adet} grup`))
      .catch((e) => uyari("kaynak yenileme", e));
  }, KAYNAK_YENILE_MS);

  const saglikTimer = setInterval(async () => {
    try {
      if (istemci?.connected) {
        await istemci.getMe();
        aktivite();
      }
    } catch (e) {
      uyari("heartbeat", e instanceof Error ? e.message : e);
    }

    const sessiz = Date.now() - sonAktivite;
    if (sessiz >= SAGLIK_ESIK_MS) {
      await saglikUyarisiGonder(
        `Son ${Math.round(sessiz / 60000)} dakikadır aktivite yok (bağlantı/okuyucu?).`
      );
    }
  }, SAGLIK_KONTROL_MS);

  const kapat = async (sinyal: string) => {
    log(`${sinyal} — kapanıyor...`);
    clearInterval(kaynakTimer);
    clearInterval(saglikTimer);
    clearInterval(tdmTimer);
    clearInterval(cevapYokTimer);
    try {
      await istemci?.disconnect();
    } catch {
      /* */
    }
    await prisma.$disconnect().catch(() => null);
    process.exit(0);
  };
  process.on("SIGTERM", () => void kapat("SIGTERM"));
  process.on("SIGINT", () => void kapat("SIGINT"));

  log("Olay dinleyici aktif (NewMessage). Polling yok.");
}

main().catch(async (e) => {
  console.error("[telegram-daemon] ölümcül:", e);
  await prisma.$disconnect().catch(() => null);
  process.exit(1);
});
