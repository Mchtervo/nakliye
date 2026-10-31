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
  getBinaryNodeChild,
  getBinaryNodeChildren,
  proto,
  useMultiFileAuthState as dosyaOturumu,
  type BinaryNode,
  type SocketConfig,
  type WAMessage,
  type WASocket,
} from "baileys";
import { rm } from "node:fs/promises";
import { AYAR_ANAHTARLARI, ayarOku } from "@/lib/ayarlar";
import { telegramGonder } from "@/lib/bildirim/telegram";
import { nabizYaz, type NabizDurum } from "@/lib/kaynaklar/daemonNabiz";
import { telefonlariCikar } from "@/lib/kaynaklar/onDedup";
import { mesajlariKuyrugaAl, type GelenGrup } from "@/lib/kaynaklar/telegramUye";
import {
  aktifWhatsappGruplari,
  davetKapat,
  gonderenTelefonu,
  katilimHakkiKullan,
  katilimHakkiVarMi,
  siradakiDavet,
  siradakiKanalDavet,
  whatsappDavetleriniHasatEt,
  whatsappGruplariniEsitle,
  whatsappKanaliKaydet,
  whatsappMetni,
  whatsappTaramaIsaretle,
  yanlisKanalDavetleriniDuzelt,
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
const KANAL_TARAMA_MS = 10 * 60 * 1000;
const KANAL_CEK_ADET = 20;
const KANAL_TARAMA_TAVAN = 25;
/** Cevapsız kanal sorgusu 60 sn beklemesin; tur 10 dk'yı aşmasın. */
const KANAL_SORGU_MS = 15_000;
const KANAL_PARALEL = 4;
const WA_SUNUCU = "s.whatsapp.net";
/** whatsmeow: hesabın katıldığı kanallar. Chrome/web sorgusu. */
const KANAL_LISTE_SORGUSU = "6388546374527196";
/** Çevrimdışıyken biriken eski mesajlar alınmaz. */
const MAX_MESAJ_YASI_SN = 2 * 60 * 60;
/** Kanal günde birkaç kez paylaşır; 6 saatte önceki ilanlar kaçıyordu. */
const MAX_KANAL_YASI_SN = 2 * 60 * 60;
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
/** Kanal adı. İlanda numara yoksa başlıktaki irtibat kullanılır. */
const kanalAdlari = new Map<string, string>();
let eslemeKoduSayisi = 0;
/** Panelde görünen bağlantı durumu; dakikada bir DB'ye yazılır. */
let durum: NabizDurum = "KOPTU";
let durumNot = "Başlıyor";

function durumAyarla(yeni: NabizDurum, not: string) {
  durum = yeni;
  durumNot = not;
  void nabizYaz("whatsapp", durum, durumNot);
}
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
    await whatsappTaramaIsaretle([...gruplar.values()]);
    log(`Gruplar: katılınan=${liste.length} yükGrubu=${yuk} takipte=${gruplar.size}`);
  } catch (e) {
    uyari("Grup eşitleme hatası:", e instanceof Error ? e.message : e);
  }
}

function kanalJidMi(id?: string | null): id is string {
  return Boolean(id?.endsWith("@newsletter"));
}

async function kanalKaydet(jid: string, ad?: string | null): Promise<void> {
  const id = await whatsappKanaliKaydet(jid, ad);
  gruplar.set(jid, id);
  const temiz = (ad || "").trim();
  if (temiz) kanalAdlari.set(jid, temiz);
}

function kanalAdiOku(satir: Record<string, unknown>): string {
  const ad = satir.name;
  if (typeof ad === "string") return ad;
  if (ad && typeof ad === "object" && "text" in ad && typeof ad.text === "string") {
    return ad.text;
  }
  const thread = satir.thread_metadata;
  if (!thread || typeof thread !== "object") return "";
  const isim = (thread as { name?: unknown }).name;
  if (typeof isim === "string") return isim;
  if (isim && typeof isim === "object" && "text" in isim && typeof isim.text === "string") {
    return isim.text;
  }
  return "";
}

function kanalJidYap(id: string): string {
  const temiz = id.trim();
  return temiz.endsWith("@newsletter") ? temiz : `${temiz}@newsletter`;
}

/** Bağlı numaranın zaten takip ettiği kanallar. Sohbet listesinde görünmezler. */
async function takiptekiKanallar(
  sock: WASocket
): Promise<{ jid: string; ad: string }[]> {
  const result = (await sock.query({
    tag: "iq",
    attrs: {
      id: sock.generateMessageTag(),
      type: "get",
      xmlns: "w:mex",
      to: WA_SUNUCU,
    },
    content: [
      {
        tag: "query",
        attrs: { query_id: KANAL_LISTE_SORGUSU },
        content: Buffer.from(JSON.stringify({ variables: {} }), "utf-8"),
      },
    ],
  })) as BinaryNode;
  const child = getBinaryNodeChild(result, "result");
  const ham = child?.content;
  if (!ham || Array.isArray(ham)) return [];
  const bayt =
    typeof ham === "string"
      ? Buffer.from(ham, "utf-8")
      : Buffer.isBuffer(ham)
        ? ham
        : Buffer.from(ham);
  const json = JSON.parse(bayt.toString("utf-8")) as {
    data?: { xwa2_newsletter_subscribed?: unknown };
    xwa2_newsletter_subscribed?: unknown;
    errors?: { message?: string }[];
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message || "kanal listesi").join(", "));
  }
  const liste =
    json.data?.xwa2_newsletter_subscribed ?? json.xwa2_newsletter_subscribed;
  if (!Array.isArray(liste)) return [];
  const cikti: { jid: string; ad: string }[] = [];
  for (const satir of liste) {
    if (!satir || typeof satir !== "object") continue;
    const kayit = satir as Record<string, unknown>;
    const id =
      typeof kayit.id === "string"
        ? kayit.id
        : typeof kayit.newsletter_id === "string"
          ? kayit.newsletter_id
          : "";
    if (!id) continue;
    cikti.push({ jid: kanalJidYap(id), ad: kanalAdiOku(kayit) });
  }
  return cikti;
}

function kanalYazisi(dugum: BinaryNode): proto.IMessage | null {
  const duz = getBinaryNodeChild(dugum, "plaintext");
  const icerik = duz?.content ?? dugum.content;
  if (!icerik || typeof icerik === "string" || Array.isArray(icerik)) {
    return typeof icerik === "string" ? { conversation: icerik } : null;
  }
  try {
    return proto.Message.decode(Buffer.from(icerik));
  } catch {
    return null;
  }
}

function kanalDugumleriniOku(result: BinaryNode, jid: string): WAMessage[] {
  const kok = getBinaryNodeChild(result, "messages") || result;
  const cikti: WAMessage[] = [];
  for (const d of getBinaryNodeChildren(kok, "message")) {
    const message = kanalYazisi(d);
    if (!message) continue;
    const ts = Number(d.attrs?.t || 0);
    cikti.push({
      key: {
        remoteJid: jid,
        id: d.attrs?.id || d.attrs?.server_id || `${jid}-${ts}`,
        fromMe: false,
      },
      messageTimestamp: ts,
      message,
    });
  }
  return cikti;
}

/**
 * Kanal gönderisinin metni. Sorgu kanalın kendi adresine gider;
 * s.whatsapp.net + message_updates yalnızca görüntülenme sayar.
 */
async function kanalIq(
  sock: WASocket,
  to: string,
  messagesAttrs: Record<string, string>
): Promise<BinaryNode> {
  return (await sock.query(
    {
      tag: "iq",
      attrs: {
        id: sock.generateMessageTag(),
        type: "get",
        xmlns: "newsletter",
        to,
      },
      content: [{ tag: "messages", attrs: messagesAttrs }],
    },
    KANAL_SORGU_MS
  )) as BinaryNode;
}

async function kanalMesajlariniCek(
  sock: WASocket,
  jid: string,
  adet: number
): Promise<WAMessage[]> {
  const adetYazi = String(adet);
  try {
    const kanala = await kanalIq(sock, jid, { count: adetYazi });
    const dogrudan = kanalDugumleriniOku(kanala, jid);
    if (dogrudan.length > 0) return dogrudan;
  } catch (e) {
    uyari("Kanal yazısı okunamadı:", e instanceof Error ? e.message : e);
  }
  const sunucu = await kanalIq(sock, WA_SUNUCU, {
    type: "jid",
    jid,
    count: adetYazi,
  });
  return kanalDugumleriniOku(sunucu, jid);
}

let kanalTaramasiSuruyor = false;

/** Önceki tur bitmeden yenisi başlamaz (yavaş kanalda turlar üst üste binmesin). */
async function kanallariTara(sock: WASocket): Promise<void> {
  if (kanalTaramasiSuruyor) return;
  kanalTaramasiSuruyor = true;
  try {
    await kanallariTaraTur(sock);
  } finally {
    kanalTaramasiSuruyor = false;
  }
}

async function kanallariTaraTur(sock: WASocket): Promise<void> {
  let bulunan = 0;
  let yukKanali = 0;
  try {
    const liste = await takiptekiKanallar(sock);
    bulunan = liste.length;
    for (const k of liste) {
      const numaraAdi = telefonlariCikar(k.ad).length > 0;
      if (k.ad && !yukGrubuAdiMi(k.ad) && !numaraAdi) continue;
      yukKanali += 1;
      await kanalKaydet(k.jid, k.ad || null);
    }
    if (bulunan > 0 && yukKanali === 0) {
      log(
        `Kanal adı yük değil, atlandı: ${liste
          .slice(0, 8)
          .map((k) =>
            telefonlariCikar(k.ad).length > 0 ? "numara" : k.ad || "adsız"
          )
          .join(" | ")}`
      );
    }
  } catch (e) {
    uyari("Takip edilen kanallar okunamadı:", e instanceof Error ? e.message : e);
  }

  const jidler = [...gruplar.keys()].filter(kanalJidMi).slice(0, KANAL_TARAMA_TAVAN);
  if (jidler.length === 0) {
    log(`Kanal taraması: takip=${bulunan} yükKanalı=0`);
    return;
  }
  let cekilen = 0;
  const kanalCek = async (jid: string) => {
    try {
      await sock.subscribeNewsletterUpdates(jid).catch(() => null);
      const mesajlar = await kanalMesajlariniCek(sock, jid, KANAL_CEK_ADET);
      if (mesajlar.length === 0) return;
      cekilen += mesajlar.length;
      await mesajlariIsle(mesajlar);
    } catch (e) {
      uyari("Kanal çekilemedi:", kanalAdlari.get(jid) || jid, e instanceof Error ? e.message : e);
    }
  };
  for (let i = 0; i < jidler.length; i += KANAL_PARALEL) {
    await Promise.all(jidler.slice(i, i + KANAL_PARALEL).map(kanalCek));
  }
  await whatsappTaramaIsaretle(jidler.map((j) => gruplar.get(j) ?? 0)).catch(() => null);
  log(`Kanal taraması: hesapta=${bulunan} yük=${yukKanali} mesaj=${cekilen}`);
}

/** Hasattan gelen kanal linkine günde az sayıda kendini ekler. */
async function kanallaraGir(sock: WASocket): Promise<void> {
  if (!(await katilimHakkiVarMi("kanal"))) return;
  const aday = await siradakiKanalDavet();
  if (!aday) return;
  try {
    const meta = await sock.newsletterMetadata("invite", aday.kod);
    const ad = (meta?.name || "").trim();
    if (!meta?.id) {
      await davetKapat(aday.id, ad || "WA kanal", "Kanal bulunamadı");
      return;
    }
    if (ad && !yukGrubuAdiMi(ad)) {
      await davetKapat(aday.id, ad, "Yük kanalı değil — takip edilmedi");
      log(`Kanal atlandı (yük değil): ${ad}`);
      return;
    }
    await sock.newsletterFollow(meta.id);
    await katilimHakkiKullan("kanal");
    await kanalKaydet(meta.id, ad || meta.id);
    await sock.subscribeNewsletterUpdates(meta.id).catch(() => null);
    await davetKapat(aday.id, ad || "WA kanal", "Takip edildi");
    log(`Kanal takip: ${ad || meta.id}`);
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    await davetKapat(aday.id, "WA kanal", `Takip edilemedi: ${mesaj}`);
    uyari("Kanal takip edilemedi:", mesaj.slice(0, 160));
  }
}

function mesajMetni(m: WAMessage): string | null {
  const metin = whatsappMetni(m.message);
  if (!metin || metin.length < MIN_METIN) return null;
  if (telefonlariCikar(metin).length > 0) return metin;
  // Numarasız ilan: irtibat gönderende ya da kanal başlığındaki numarada
  const tel = gonderenTelefonu(m.key);
  if (tel) return `${metin}\nTel: ${tel}`;
  const jid = m.key.remoteJid;
  const baslikTel = jid ? telefonlariCikar(kanalAdlari.get(jid) || "")[0] : "";
  return baslikTel ? `${metin}\nTel: ${baslikTel}` : metin;
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

function sohbetKimlikleri(m: WAMessage): string[] {
  const ids = [m.key.remoteJid, m.key.remoteJidAlt].filter(
    (j): j is string => Boolean(j)
  );
  return [...new Set(ids)];
}

function grupSohbetiMi(ids: string[]): boolean {
  return ids.some((j) => j.endsWith("@g.us"));
}

function kanalSohbetiMi(ids: string[]): boolean {
  return ids.some((j) => j.endsWith("@newsletter"));
}

function kaynakIdBul(ids: string[]): number | null {
  for (const j of ids) {
    const id = gruplar.get(j);
    if (id) return id;
  }
  return null;
}

async function mesajlariIsle(mesajlar: WAMessage[]) {
  const simdiSn = Math.floor(Date.now() / 1000);
  const grupBazli = new Map<number, GelenGrup["mesajlar"]>();

  for (const m of mesajlar) {
    const ids = sohbetKimlikleri(m);
    const grupMu = grupSohbetiMi(ids);
    const kanalMu = kanalSohbetiMi(ids);
    if (!grupMu && !kanalMu && !m.key.fromMe) {
      const ozel = ids.find((j) => j.endsWith("@s.whatsapp.net")) || null;
      const yazi = whatsappMetni(m.message);
      if (ozel && yazi) {
        await gelenOzelMesajiIsle(ozel, yazi).catch((e) => {
          uyari("Özel cevap işlenemedi:", e instanceof Error ? e.message : e);
        });
      }
    }
    if ((!grupMu && !kanalMu) || m.key.fromMe || ids.length === 0) continue;
    const ham = whatsappMetni(m.message);
    if (ham) await whatsappDavetleriniHasatEt(ham, "WA mesaj").catch(() => null);
    let kaynakId = kaynakIdBul(ids);
    if (!kaynakId && kanalMu) {
      const kanalJid = ids.find((j) => j.endsWith("@newsletter"))!;
      kaynakId = await whatsappKanaliKaydet(kanalJid);
      for (const j of ids) gruplar.set(j, kaynakId);
    }
    if (!kaynakId) continue;
    for (const j of ids) gruplar.set(j, kaynakId);
    const zaman = Number(m.messageTimestamp ?? 0);
    const maxYas = kanalMu ? MAX_KANAL_YASI_SN : MAX_MESAJ_YASI_SN;
    if (zaman > 0 && simdiSn - zaman > maxYas) continue;
    const metin = mesajMetni(m);
    if (!metin) continue;
    const liste = grupBazli.get(kaynakId) ?? [];
    liste.push({ mesajId: null, metin, gonderenUserId: null, zaman: zaman > 0 ? new Date(zaman * 1000) : null });
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
  // WhatsApp bağlı cihazı otomatik yazıya kilitledi; yazma kapalı, okuma açık.
  if (process.env.WHATSAPP_YAZMA !== "1") return;
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
    // true iken telefon WhatsApp bildirimlerini susturuyordu
    markOnlineOnConnect: false,
    syncFullHistory: false,
    // 2 saatten eski mesaj zaten işlenmiyor: yalnız "son mesajlar" senkronu
    shouldSyncHistoryMessage: ({ syncType }) =>
      syncType === proto.HistorySync.HistorySyncType.RECENT,
  });

  sock.ev.on("creds.update", saveCreds);

  let kodIstendi = false;
  let esitlemeZamanlayici: ReturnType<typeof setInterval> | null = null;
  let gorusmeZamanlayici: ReturnType<typeof setInterval> | null = null;
  let kanalZamanlayici: ReturnType<typeof setInterval> | null = null;

  sock.ev.on("connection.update", async (u) => {
    if (u.qr && !kodIstendi && !state.creds.registered) {
      kodIstendi = true;
      eslemeKoduSayisi += 1;
      try {
        const kod = await sock.requestPairingCode(TELEFON);
        log(`EŞLEME KODU: ${kod} — WhatsApp > Bağlı cihazlar > Telefon numarasıyla bağla`);
        durumAyarla(
          "ESLEME_BEKLIYOR",
          `Kod: ${kod} — WhatsApp → Bağlı cihazlar → Cihaz bağla → Telefon numarasıyla bağla`
        );
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
      durumAyarla("BAGLI", "Bağlı");
      const duzelen = await yanlisKanalDavetleriniDuzelt().catch(() => 0);
      if (duzelen) log(`Kanal davet düzeltildi: ${duzelen}`);
      await gruplariEsitle(sock);
      gruplar = await aktifWhatsappGruplari();
      await davetlereGir(sock);
      await kanallaraGir(sock);
      void kanallariTara(sock);
      void gorusmeleriYurut(sock);
      if (esitlemeZamanlayici) clearInterval(esitlemeZamanlayici);
      if (gorusmeZamanlayici) clearInterval(gorusmeZamanlayici);
      if (kanalZamanlayici) clearInterval(kanalZamanlayici);
      esitlemeZamanlayici = setInterval(() => {
        void gruplariEsitle(sock);
        void davetlereGir(sock);
      }, GRUP_ESITLEME_MS);
      gorusmeZamanlayici = setInterval(() => void gorusmeleriYurut(sock), 60 * 1000);
      kanalZamanlayici = setInterval(() => {
        void kanallaraGir(sock);
        void kanallariTara(sock);
      }, KANAL_TARAMA_MS);
    }

    if (u.connection === "close") {
      if (esitlemeZamanlayici) clearInterval(esitlemeZamanlayici);
      if (gorusmeZamanlayici) clearInterval(gorusmeZamanlayici);
      if (kanalZamanlayici) clearInterval(kanalZamanlayici);
      const kod = (u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      if (kod === DisconnectReason.loggedOut) {
        // Kapanan oturum işe yaramaz; silinip yeni eşleme kodu istenir (kod panelde görünür).
        uyari("Oturum kapatıldı (telefondan çıkış veya engel). Yeni eşleme kodu isteniyor.");
        durumAyarla("OTURUM_KAPANDI", "Oturum kapandı — birazdan yeni eşleme kodu burada çıkar");
        await bildir(
          `<b>Yük Avcısı — WhatsApp oturumu kapandı</b>\nYeni eşleme kodu yük ekranında çıkacak.`
        );
        await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => null);
        setTimeout(() => void baglan(), 10_000);
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
        durumAyarla(
          "ESLEME_BEKLIYOR",
          "Kodlar kullanılmadı; 1 saat içinde yeni kod gelir (hemen için: sudo systemctl restart yukavci-whatsapp)"
        );
      } else {
        log(`Bağlantı kapandı (kod=${kod ?? "-"}); yeniden bağlanılıyor.`);
        if (state.creds.registered && kod !== DisconnectReason.restartRequired) {
          durumAyarla("KOPTU", `Bağlantı koptu (kod=${kod ?? "-"}), yeniden bağlanıyor`);
        }
      }
      setTimeout(() => void baglan(), bekle);
    }
  });

  sock.ev.on("messages.upsert", ({ messages }) => {
    // notify = canlı, append = bildirim, prepend = geçmiş senkronu
    void mesajlariIsle(messages);
  });

  const sohbetKanallari = (chats: { id?: string | null; name?: string | null }[]) => {
    for (const c of chats) {
      if (!kanalJidMi(c.id)) continue;
      void kanalKaydet(c.id, c.name);
    }
  };
  sock.ev.on("chats.upsert", sohbetKanallari);
  sock.ev.on("chats.update", sohbetKanallari);
  sock.ev.on("messaging-history.set", ({ chats, messages }) => {
    sohbetKanallari(chats);
    if (messages.length) void mesajlariIsle(messages);
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
  setInterval(() => void nabizYaz("whatsapp", durum, durumNot), 60 * 1000);
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
  await baglan();
}

void main().catch((e) => {
  uyari("Ölümcül hata:", e instanceof Error ? e.message : e);
  process.exit(1);
});
