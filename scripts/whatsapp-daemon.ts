/**
 * WhatsApp yük grubu okuyucu (Baileys bağlı cihaz, tarayıcı gerekmez).
 * Gelen grup mesajları Telegram ile aynı kuyruğa yazılır; AI cron işler.
 *
 * Env:
 *   WHATSAPP_TELEFON   eşleme numarası, ülke koduyla: 905xxxxxxxxx
 *   WHATSAPP_AUTH_DIR  oturum klasörü (varsayılan .wa-oturum) — gizli, commit edilmez
 *
 * İlk çalıştırmada eşleme kodu loga ve Telegram bildirim sohbetine düşer:
 * WhatsApp → Bağlı cihazlar → Cihaz bağla → "Telefon numarasıyla bağla".
 */
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestWaWebVersion,
  useMultiFileAuthState as dosyaOturumu,
  type SocketConfig,
  type WAMessage,
  type WASocket,
} from "baileys";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { telegramGonder } from "@/lib/bildirim/telegram";
import { telefonlariCikar } from "@/lib/kaynaklar/onDedup";
import { mesajlariKuyrugaAl, type GelenGrup } from "@/lib/kaynaklar/telegramUye";
import {
  aktifWhatsappGruplari,
  davetKapat,
  gonderenTelefonu,
  katilimHakkiKullan,
  katilimHakkiVarMi,
  siradakiDavet,
  whatsappDavetleriniHasatEt,
  whatsappGruplariniEsitle,
  whatsappKanaliKaydet,
  whatsappMetni,
  yukGrubuAdiMi,
} from "@/lib/kaynaklar/whatsapp";
import {
  gelenOzelMesajiIsle,
  gorusmeGonderildi,
  gorusmeHata,
  siradakiGorusme,
} from "@/lib/kaynaklar/waGorusme";

const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR || ".wa-oturum";
const TELEFON = (process.env.WHATSAPP_TELEFON || "").replace(/\D/g, "");
const GRUP_ESITLEME_MS = 30 * 60 * 1000;
/** Çevrimdışıyken biriken eski mesajlar alınmaz. */
const MAX_MESAJ_YASI_SN = 6 * 60 * 60;
const MIN_METIN = 15;
/** Kullanılmayan eşleme kodu sınırı; aşılınca bir saat beklenir (bildirim seli olmasın). */
const MAX_ESLEME_KODU = 5;
const ESLEME_BEKLEME_MS = 60 * 60 * 1000;

function log(...args: unknown[]) {
  console.log(`[whatsapp-daemon ${new Date().toISOString()}]`, ...args);
}

function uyari(...args: unknown[]) {
  console.warn(`[whatsapp-daemon ${new Date().toISOString()}]`, ...args);
}

type Logger = SocketConfig["logger"];

function sessizLogger(): Logger {
  const bos = () => {};
  const l: Logger = {
    level: "silent",
    child: () => l,
    trace: bos,
    debug: bos,
    info: bos,
    warn: bos,
    error: bos,
  };
  return l;
}

async function bildir(metin: string) {
  const chatId = await ayarOku(AYAR_ANAHTARLARI.telegramChatId);
  if (!chatId) return;
  const sonuc = await telegramGonder(chatId, metin);
  if (!sonuc.basarili) uyari("Bildirim gönderilemedi:", sonuc.hata);
}

let gruplar = new Map<string, number>();
let eslemeKoduSayisi = 0;
let alinan = 0;
let kuyruga = 0;

async function gruplariEsitle(sock: WASocket) {
  try {
    const hepsi = await sock.groupFetchAllParticipating();
    const liste = Object.values(hepsi).map((g) => ({
      jid: g.id,
      ad: g.subject || "",
      uyeSayisi: g.size ?? g.participants?.length ?? null,
    }));
    const yuk = await whatsappGruplariniEsitle(liste);
    gruplar = await aktifWhatsappGruplari();
    log(`Gruplar: katılınan=${liste.length} yükGrubu=${yuk} takipte=${gruplar.size}`);
  } catch (e) {
    uyari("Grup eşitleme hatası:", e instanceof Error ? e.message : e);
  }
}

function mesajMetni(m: WAMessage): string | null {
  const metin = whatsappMetni(m.message);
  if (!metin || metin.length < MIN_METIN) return null;
  if (telefonlariCikar(metin).length > 0) return metin;
  // Numarasız ilan: WhatsApp'ta irtibat genelde gönderenin kendisi
  const tel = gonderenTelefonu(m.key);
  return tel ? `${metin}\nTel: ${tel}` : metin;
}

/** Günde bir grup. Adı yük/nakliye değilse girmez, sonrakine bakar. */
async function davetlereGir(sock: WASocket) {
  if (!(await katilimHakkiVarMi())) return;
  for (let deneme = 0; deneme < 6; deneme += 1) {
    const aday = await siradakiDavet();
    if (!aday) return;
    try {
      const bilgi = await sock.groupGetInviteInfo(aday.kod);
      const ad = (bilgi.subject || "").trim();
      if (!yukGrubuAdiMi(ad)) {
        await davetKapat(aday.id, ad || "adsız grup", "Yük grubu değil — girilmedi");
        log(`Atlandı (yük grubu değil): ${ad || aday.kod}`);
        continue;
      }
      await sock.groupAcceptInvite(aday.kod);
      await katilimHakkiKullan();
      await davetKapat(aday.id, ad, "Girildi");
      log(`Gruba girildi: ${ad}`);
      await gruplariEsitle(sock);
      return;
    } catch (e) {
      const mesaj = e instanceof Error ? e.message : String(e);
      await davetKapat(aday.id, "WA davet", `Girilemedi: ${mesaj}`);
      uyari("Davet girilemedi:", mesaj.slice(0, 160));
      return;
    }
  }
}

async function mesajlariIsle(mesajlar: WAMessage[]) {
  const simdiSn = Math.floor(Date.now() / 1000);
  const grupBazli = new Map<number, GelenGrup["mesajlar"]>();

  for (const m of mesajlar) {
    const jid = m.key.remoteJid;
    const grupMu = Boolean(jid?.endsWith("@g.us"));
    const kanalMu = Boolean(jid?.endsWith("@newsletter"));
    if (!grupMu && !kanalMu && !m.key.fromMe) {
      const ozel =
        [m.key.remoteJid, m.key.remoteJidAlt].find((j) => j?.endsWith("@s.whatsapp.net")) ||
        null;
      const yazi = whatsappMetni(m.message);
      if (ozel && yazi) {
        await gelenOzelMesajiIsle(ozel, yazi).catch((e) => {
          uyari("Özel cevap işlenemedi:", e instanceof Error ? e.message : e);
        });
      }
    }
    if ((!grupMu && !kanalMu) || m.key.fromMe || !jid) continue;
    const ham = whatsappMetni(m.message);
    if (ham) await whatsappDavetleriniHasatEt(ham, "WA mesaj").catch(() => null);
    let kaynakId = gruplar.get(jid) ?? null;
    if (!kaynakId && kanalMu) {
      kaynakId = await whatsappKanaliKaydet(jid);
      gruplar.set(jid, kaynakId);
    }
    if (!kaynakId) continue;
    const zaman = Number(m.messageTimestamp ?? 0);
    if (zaman > 0 && simdiSn - zaman > MAX_MESAJ_YASI_SN) continue;
    const metin = mesajMetni(m);
    if (!metin) continue;
    const liste = grupBazli.get(kaynakId) ?? [];
    liste.push({ mesajId: null, metin, gonderenUserId: null });
    grupBazli.set(kaynakId, liste);
  }
  if (grupBazli.size === 0) return;

  const gelen: GelenGrup[] = [...grupBazli].map(([id, liste]) => ({ id, mesajlar: liste }));
  try {
    const rapor = await mesajlariKuyrugaAl(gelen);
    alinan += rapor.alinan;
    kuyruga += rapor.kuyruga;
    if (rapor.kuyruga > 0) log(`Kuyruğa: ${rapor.kuyruga}/${rapor.alinan} (grup=${rapor.grup})`);
  } catch (e) {
    uyari("Kuyruğa yazma hatası:", e instanceof Error ? e.message : e);
  }
}

/** Kuyruktaki bir soruyu gönderir. Kota ve ara lib tarafında. */
async function gorusmeleriYurut(sock: WASocket) {
  const sira = await siradakiGorusme().catch((e) => {
    uyari("Soru kuyruğu okunamadı:", e instanceof Error ? e.message : e);
    return null;
  });
  if (!sira) return;
  try {
    const kontrol = await sock.onWhatsApp(sira.e164);
    const hedef = kontrol?.find((k) => k.exists);
    if (!hedef) {
      await gorusmeHata(sira.id, "Bu numarada WhatsApp yok");
      log(`Yazılmadı #${sira.id}: WhatsApp yok`);
      return;
    }
    await sock.sendMessage(hedef.jid, { text: sira.metin });
    await gorusmeGonderildi(sira.id, sira.hatirlatma);
    log(`Yazıldı #${sira.id}`);
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    await gorusmeHata(sira.id, mesaj).catch(() => null);
    uyari("Soru gönderilemedi:", mesaj.slice(0, 160));
  }
}

async function baglan(): Promise<void> {
  const { state, saveCreds } = await dosyaOturumu(AUTH_DIR);

  if (!state.creds.registered && !/^\d{10,15}$/.test(TELEFON)) {
    uyari("Oturum yok ve WHATSAPP_TELEFON tanımsız/geçersiz (örn. 905xxxxxxxxx). Çıkılıyor.");
    process.exit(1);
  }

  let version: [number, number, number] | undefined;
  try {
    version = (await fetchLatestWaWebVersion()).version;
  } catch {
    version = undefined;
  }

  const sock = makeWASocket({
    auth: state,
    ...(version ? { version } : {}),
    browser: Browsers.ubuntu("Chrome"),
    logger: sessizLogger(),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
  });

  sock.ev.on("creds.update", saveCreds);

  let kodIstendi = false;
  let esitlemeZamanlayici: ReturnType<typeof setInterval> | null = null;
  let gorusmeZamanlayici: ReturnType<typeof setInterval> | null = null;

  sock.ev.on("connection.update", async (u) => {
    if (u.qr && !kodIstendi && !state.creds.registered) {
      kodIstendi = true;
      eslemeKoduSayisi += 1;
      try {
        const kod = await sock.requestPairingCode(TELEFON);
        log(`EŞLEME KODU: ${kod} — WhatsApp > Bağlı cihazlar > Telefon numarasıyla bağla`);
        await bildir(
          `<b>Yük Avcısı — WhatsApp eşleme kodu</b>\n<code>${kod}</code>\n` +
            `WhatsApp → Bağlı cihazlar → Cihaz bağla → "Telefon numarasıyla bağla"`
        );
      } catch (e) {
        uyari("Eşleme kodu alınamadı:", e instanceof Error ? e.message : e);
      }
    }

    if (u.connection === "open") {
      eslemeKoduSayisi = 0;
      log("Bağlandı.");
      await gruplariEsitle(sock);
      await davetlereGir(sock);
      void gorusmeleriYurut(sock);
      if (esitlemeZamanlayici) clearInterval(esitlemeZamanlayici);
      if (gorusmeZamanlayici) clearInterval(gorusmeZamanlayici);
      esitlemeZamanlayici = setInterval(() => {
        void gruplariEsitle(sock);
        void davetlereGir(sock);
      }, GRUP_ESITLEME_MS);
      gorusmeZamanlayici = setInterval(() => void gorusmeleriYurut(sock), 60 * 1000);
    }

    if (u.connection === "close") {
      if (esitlemeZamanlayici) clearInterval(esitlemeZamanlayici);
      if (gorusmeZamanlayici) clearInterval(gorusmeZamanlayici);
      const kod = (u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      if (kod === DisconnectReason.loggedOut) {
        uyari("Oturum kapatıldı (telefondan çıkış veya engel). Yeniden eşleme gerekiyor.");
        await bildir(
          `<b>Yük Avcısı — WhatsApp okuyucu durdu</b>\nOturum kapatıldı; ` +
            `sunucuda ${AUTH_DIR} klasörünü silip servisi yeniden başlatınca yeni eşleme kodu gelir.`
        );
        return;
      }
      const bekle =
        kod === DisconnectReason.restartRequired
          ? 1000
          : !state.creds.registered && eslemeKoduSayisi >= MAX_ESLEME_KODU
            ? ESLEME_BEKLEME_MS
            : 5000;
      if (bekle > 5000) {
        eslemeKoduSayisi = 0;
        uyari("Eşleme kodları kullanılmadı; 1 saat sonra tekrar denenecek.");
      } else {
        log(`Bağlantı kapandı (kod=${kod ?? "-"}); yeniden bağlanılıyor.`);
      }
      setTimeout(() => void baglan(), bekle);
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type === "notify") {
      void mesajlariIsle(messages);
      return;
    }
    // Kanallar çoğu zaman "append" gelir; grup geçmişi alınmaz
    if (type === "append") {
      const kanallar = messages.filter((m) => m.key.remoteJid?.endsWith("@newsletter"));
      if (kanallar.length > 0) void mesajlariIsle(kanallar);
    }
  });

  sock.ev.on("groups.upsert", () => void gruplariEsitle(sock));
}

async function main() {
  log(`Başlıyor. Oturum klasörü: ${AUTH_DIR}`);
  setInterval(() => {
    log(`Saatlik: alınan=${alinan} kuyruğa=${kuyruga} takipte=${gruplar.size}`);
    alinan = 0;
    kuyruga = 0;
  }, 60 * 60 * 1000);
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
  await baglan();
}

void main().catch((e) => {
  uyari("Ölümcül hata:", e instanceof Error ? e.message : e);
  process.exit(1);
});
