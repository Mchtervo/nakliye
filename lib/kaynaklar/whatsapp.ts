/**
 * WhatsApp yük grupları (Baileys bağlı cihaz). Okuyucu: scripts/whatsapp-daemon.ts.
 * Mesajlar Telegram ile aynı kuyruğa (mesajlariKuyrugaAl) yazılır.
 */
import { prisma } from "@/lib/prisma";
import { sadelestir } from "@/lib/iller";

export const WHATSAPP_GRUP = "WHATSAPP_GRUP";

/**
 * Yalnızca adı yük/nakliye grubu gibi görünenler kaydedilir ve okunur;
 * kişisel gruplar (aile, okul…) DB'ye hiç yazılmaz.
 */
const YUK_GRUBU_KALIP =
  /\b(yuk|yukler|yukleme|nakliye|nakliyat|lojistik|tir|tirlar|kamyon|kamyoncu|tasima|tasimacilik|parsiyel|frigo|dorse|tenteli|navlun|sofor|arac|araclar|kirkayak|damper|lowbed|transport|logistics)\w*/;

export function yukGrubuAdiMi(ad: string): boolean {
  return YUK_GRUBU_KALIP.test(sadelestir(ad));
}

export type WhatsappGrubu = { jid: string; ad: string; uyeSayisi: number | null };

/**
 * Katılınan yük gruplarını kaynak tablosuna yazar; panelden kapatılan
 * grubun durumunu ezmez. Dönüş: kaydedilen yük grubu adedi.
 */
export async function whatsappGruplariniEsitle(gruplar: WhatsappGrubu[]): Promise<number> {
  let adet = 0;
  for (const g of gruplar) {
    const ad = g.ad.trim();
    if (!ad || !yukGrubuAdiMi(ad)) continue;
    adet += 1;
    await prisma.ilanKaynagi.upsert({
      where: { tur_hedef: { tur: WHATSAPP_GRUP, hedef: g.jid } },
      update: { ad, uyeSayisi: g.uyeSayisi },
      create: {
        tur: WHATSAPP_GRUP,
        hedef: g.jid,
        ad,
        uyeSayisi: g.uyeSayisi,
        aktif: true,
        durum: "AKTIF",
      },
    });
  }
  return adet;
}

const WA_DAVET_KALIP =
  /(?:https?:\/\/)?(?:www\.)?(chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_\-]+)/gi;

export type WhatsappLinkTip = "grup" | "kanal";

export type WhatsappLink = { tip: WhatsappLinkTip; kod: string };

/** WhatsApp kanal davet kodları genelde 0029 ile başlar. */
export function kanalKoduMu(kod: string): boolean {
  return kod.startsWith("0029");
}

export function whatsappLinkleri(metin: string): WhatsappLink[] {
  const cikti: WhatsappLink[] = [];
  const gorulen = new Set<string>();
  const re = new RegExp(WA_DAVET_KALIP.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(metin)) !== null) {
    const yol = m[1] || "";
    const kod = m[2];
    if (!kod || gorulen.has(kod)) continue;
    gorulen.add(kod);
    const tip: WhatsappLinkTip =
      /channel/i.test(yol) || kanalKoduMu(kod) ? "kanal" : "grup";
    cikti.push({ tip, kod });
  }
  return cikti;
}

export function whatsappDavetKodlari(metin: string): string[] {
  return whatsappLinkleri(metin).map((l) => l.kod);
}

export function whatsappDavetUrl(kod: string): string {
  return `https://chat.whatsapp.com/${kod}`;
}

export function whatsappKanalUrl(kod: string): string {
  return `https://www.whatsapp.com/channel/${kod}`;
}

/** Herkese açık, Ankara/koridor civarı davetler. Sanal numara günde birkaçına kendi girer. */
const BILINEN_DAVETLER = [
  "BW9NmtsjshxE0Cq5xTqZ7V",
  "EWeW56jhh0IHvpADg8bMs8",
  "CKAnkHWFL6rKOd99ZliDmt",
  "lphp40x2a9jhyq8s0mrnfu",
  // 2026-10-28: Facebook/Instagram/ilan sitelerinde açık paylaşılmış nakliye grupları.
  // Numara girmeden önce grup adını kontrol eder; yük grubu değilse girmez.
  "BO2tWW3kLXRG8JOT88Tm8C", // Ankara Net Nakliyat
  "I8vX7ZgNR3O8kKlgO80O55", // Ankara Ostim/Akyurt ilanında paylaşılan grup
  "D5f52IZrvau6LQSJUoEMpX", // Gebze Nakliyeciler Sitesi
  "G15ZnH08nDM7aYaTrkXoCu", // Gebze Nakliyeciler Sitesi (2)
  "CQRM9CbLVVcB9kCRz3coRW", // Kocaeli nakliye grubu
  "KQaryc8coziAJ8Of4bxkum", // 7/24 Yük Paylaşım Nakliye Lojistik
  "Bbe46M0k6931RbwcwMHinn", // Tüm Nakliyeciler Burada
  "LWHyGtCl3p10qQUFvBqHDe", // Tüm Türkiye nakliye
  "INHANQG8iTB3unbiIVLL1D", // Tırcılar / kamyoncular
  "C1bdcvhAwPU3yGoUSYAch7", // CS Nakliyat (7/24 yüklemeli)
  "EG7JfSdi0oGLwdKjfyCW8K", // Erollar Lojistik nakliye grubu
  "Jrjkq2whcf6DVBv7diSRAK", // Yük veren + taşıyıcı grubu
  "BpmY8jsJPac9bMlr67Ej9B", // Nakliyeciler grubu (Instagram)
  "FjoWC9D6JC1A9yFQzxd6qa", // Türkiye geneli açık tır + tenteli grubu
  "ERogKJRbHnD7JubXkUi060", // Tenteli yükleme ilanında paylaşılan grup
  "EAs6xxu99SK5qK9cr8z5ZZ", // MKT Grup Ankara nakliye
  "DxjOjiJ29rkAsHKbNCIjXB", // Nakliyeciler WhatsApp iş paylaşım
  "BTctNSSrBhjCr1eWiInnTI", // Nakliyeciler sitesi yük grubu
  "CzYEyiDS0mb9oY9AGwnee4", // Yük paylaşım grubu (Kocaeli/Sapanca)
  "CCEtde41wrOAcyEHmIQCL6", // Güncel yük ve araç paylaşımları 3
  "FUvsy6gyslIEgVa77p6IQi", // Balıkesir/İstanbul lojistik yük grubu
  "ImRUbaf18HqDLOE7zPQF8V", // Asilhan Nakliyat yük paylaşım
];

export async function bilinenDavetleriYaz(): Promise<void> {
  // Ayarlar her açılışta ~26 davet × birkaç sorgu yapıyordu: liste değişmedikçe bir kez.
  const IMZA_ANAHTAR = "bilinen_davetler_imza";
  const imza = BILINEN_DAVETLER.join(",");
  const onceki = await prisma.ayar.findUnique({ where: { anahtar: IMZA_ANAHTAR } });
  if (onceki?.deger === imza) return;
  for (const kod of BILINEN_DAVETLER) {
    await whatsappDavetiniKaydet(kod, "Açık davet").catch(() => null);
  }
  await prisma.ayar.upsert({
    where: { anahtar: IMZA_ANAHTAR },
    update: { deger: imza },
    create: { anahtar: IMZA_ANAHTAR, deger: imza },
  });
}

/**
 * Günlük katılım kotası. Grup girişleri okuyucuda 30 dk arayla denenir
 * (12 grup gün içine yayılır); WhatsApp hız sınırı uyarısı gelirse o gün
 * katılım durur (katilimiBugunDurdur). Kanal takibi daha az riskli.
 * 4 grup / 10 kanal ile 190+ bekleyen link ~47 gün sürüyordu.
 */
const KATILIM = {
  grup: { anahtar: "whatsapp_katilim_sayac", gunluk: 12 },
  kanal: { anahtar: "whatsapp_kanal_takip_sayac", gunluk: 25 },
} as const;

export const KATILIM_GUNLUK = { grup: KATILIM.grup.gunluk, kanal: KATILIM.kanal.gunluk };

/** WhatsApp "çok hızlı / sınır" yanıtı mı (davet bozuk değil, beklemek gerek). */
export function hizSiniriHatasiMi(mesaj: string): boolean {
  return /rate|overlimit|over-limit|429|too many|limit/i.test(mesaj);
}

/** Hız sınırı uyarısında o günün kotasını doldurur: yarın kaldığı yerden devam. */
export async function katilimiBugunDurdur(tip: WhatsappLinkTip = "grup"): Promise<void> {
  const { anahtar, gunluk } = KATILIM[tip];
  const deger = JSON.stringify({ gun: bugunTr(), adet: gunluk, durduruldu: true });
  await prisma.ayar.upsert({ where: { anahtar }, update: { deger }, create: { anahtar, deger } });
}

function bugunTr(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function katilimHakkiVarMi(tip: WhatsappLinkTip = "grup"): Promise<boolean> {
  const { anahtar, gunluk } = KATILIM[tip];
  const kayit = await prisma.ayar.findUnique({ where: { anahtar } });
  if (!kayit) return true;
  try {
    const j = JSON.parse(kayit.deger) as { gun?: string; adet?: number };
    if (j.gun !== bugunTr()) return true;
    return (j.adet ?? 0) < gunluk;
  } catch {
    return true;
  }
}

export async function katilimHakkiKullan(tip: WhatsappLinkTip = "grup"): Promise<void> {
  const KATILIM_ANAHTAR = KATILIM[tip].anahtar;
  const gun = bugunTr();
  const kayit = await prisma.ayar.findUnique({ where: { anahtar: KATILIM_ANAHTAR } });
  let adet = 0;
  if (kayit) {
    try {
      const j = JSON.parse(kayit.deger) as { gun?: string; adet?: number };
      if (j.gun === gun) adet = j.adet ?? 0;
    } catch {
      adet = 0;
    }
  }
  const deger = JSON.stringify({ gun, adet: adet + 1 });
  await prisma.ayar.upsert({
    where: { anahtar: KATILIM_ANAHTAR },
    update: { deger },
    create: { anahtar: KATILIM_ANAHTAR, deger },
  });
}

export async function siradakiDavet(): Promise<{ id: number; kod: string } | null> {
  const aday = await prisma.ilanKaynagi.findFirst({
    where: {
      tur: WHATSAPP_GRUP,
      durum: "ADAY",
      hedef: { startsWith: "https://chat.whatsapp.com/" },
      NOT: { hedef: { startsWith: "https://chat.whatsapp.com/0029" } },
    },
    orderBy: [{ oncelik: "desc" }, { id: "asc" }],
    select: { id: true, hedef: true },
  });
  if (!aday) return null;
  const kod = aday.hedef.split("/").pop()?.split("?")[0] || "";
  if (!kod) return null;
  return { id: aday.id, kod };
}

export async function siradakiKanalDavet(): Promise<{ id: number; kod: string } | null> {
  const aday = await prisma.ilanKaynagi.findFirst({
    where: {
      tur: WHATSAPP_GRUP,
      durum: "ADAY",
      OR: [
        { hedef: { contains: "whatsapp.com/channel/" } },
        { hedef: { startsWith: "https://chat.whatsapp.com/0029" } },
      ],
    },
    orderBy: [{ oncelik: "desc" }, { id: "asc" }],
    select: { id: true, hedef: true },
  });
  if (!aday) return null;
  const kod = aday.hedef.split("/").pop()?.split("?")[0] || "";
  if (!kod) return null;
  return { id: aday.id, kod };
}

/** Yanlışlıkla grup daveti diye yazılmış kanal kodlarını kanal sırasına alır. */
export async function yanlisKanalDavetleriniDuzelt(): Promise<number> {
  const yanlis = await prisma.ilanKaynagi.findMany({
    where: {
      tur: WHATSAPP_GRUP,
      durum: "ADAY",
      hedef: { startsWith: "https://chat.whatsapp.com/0029" },
    },
    select: { id: true, hedef: true },
  });
  let adet = 0;
  for (const y of yanlis) {
    const kod = y.hedef.split("/").pop()?.split("?")[0] || "";
    if (!kod) continue;
    try {
      await prisma.ilanKaynagi.update({
        where: { id: y.id },
        data: {
          hedef: whatsappKanalUrl(kod),
          ad: `WA kanal ${kod.slice(0, 10)}`,
          sonHata: "Sırada — kanal takibi",
        },
      });
      adet += 1;
    } catch {
      /* aynı kanal URL'si zaten varsa unique */
    }
  }
  return adet;
}

export async function davetKapat(id: number, ad: string, not: string): Promise<void> {
  await prisma.ilanKaynagi.update({
    where: { id },
    data: {
      durum: "PASIF",
      aktif: false,
      ad: (ad || "WA davet").slice(0, 120),
      sonHata: not.slice(0, 300),
    },
  });
}

/** Takip edilen WhatsApp kanalı (ilan duyurusu). */
export async function whatsappKanaliKaydet(
  jid: string,
  ad?: string | null
): Promise<number> {
  const isim = (ad || "").trim().slice(0, 120) || "WhatsApp kanalı";
  const satir = await prisma.ilanKaynagi.upsert({
    where: { tur_hedef: { tur: WHATSAPP_GRUP, hedef: jid } },
    update: isim !== "WhatsApp kanalı" ? { ad: isim, aktif: true, durum: "AKTIF" } : { aktif: true, durum: "AKTIF" },
    create: {
      tur: WHATSAPP_GRUP,
      hedef: jid,
      ad: isim,
      aktif: true,
      durum: "AKTIF",
    },
    select: { id: true },
  });
  return satir.id;
}

/** Davet linkini ADAY olarak yazar; sanal numara uygunsa kendisi girer. */
export async function whatsappDavetiniKaydet(
  kod: string,
  hasatKaynak: string,
  tip: WhatsappLinkTip = kanalKoduMu(kod) ? "kanal" : "grup",
  /** Elle eklenen linkler hasattan önce girilsin diye yüksek verilir. */
  oncelikZorla?: number
): Promise<"yeni" | "mevcut"> {
  const hedef = tip === "kanal" ? whatsappKanalUrl(kod) : whatsappDavetUrl(kod);
  const varOlan = await prisma.ilanKaynagi.findUnique({
    where: { tur_hedef: { tur: WHATSAPP_GRUP, hedef } },
    select: { id: true },
  });
  if (varOlan) return "mevcut";
  await prisma.ilanKaynagi.create({
    data: {
      tur: WHATSAPP_GRUP,
      hedef,
      ad: tip === "kanal" ? `WA kanal ${kod.slice(0, 10)}` : `WA davet ${kod.slice(0, 10)}`,
      aktif: false,
      durum: "ADAY",
      oncelik: oncelikZorla ?? (tip === "kanal" ? 14 : 12),
      hasatKaynak: hasatKaynak.slice(0, 120),
      sonHata:
        tip === "kanal"
          ? "Sırada — kanal takibi"
          : "Sırada — numara günde en fazla 8 gruba kendi girer",
    },
  });
  return "yeni";
}

/** Mesajdaki chat.whatsapp.com linklerini ADAY havuzuna yazar (kartopu). */
export async function whatsappDavetleriniHasatEt(
  metin: string,
  hasatKaynak: string
): Promise<{ yeni: number; mevcut: number }> {
  const rapor = { yeni: 0, mevcut: 0 };
  for (const l of whatsappLinkleri(metin)) {
    try {
      const s = await whatsappDavetiniKaydet(l.kod, hasatKaynak, l.tip);
      rapor[s] += 1;
    } catch {
      /* unique yarışı */
    }
  }
  return rapor;
}

/** Eski Telegram hasadındaki wa: satırlarını WhatsApp ADAY'a taşır. */
export async function eskiWhatsappHasatiniTasi(): Promise<number> {
  const eski = await prisma.ilanKaynagi.findMany({
    where: { tur: "TELEGRAM_UYE", hedef: { startsWith: "wa:" } },
    select: { id: true, hedef: true, hasatKaynak: true },
  });
  let tasinan = 0;
  for (const e of eski) {
    const kod = e.hedef.slice(3);
    if (kod) {
      await whatsappDavetiniKaydet(kod, e.hasatKaynak || "eski Telegram hasadı");
      tasinan += 1;
    }
    await prisma.ilanKaynagi.delete({ where: { id: e.id } }).catch(() => null);
  }
  return tasinan;
}

export type WhatsappDavetAdayi = {
  id: number;
  ad: string;
  hedef: string;
  hasatKaynak: string | null;
};

export async function whatsappDavetAdaylari(): Promise<WhatsappDavetAdayi[]> {
  return prisma.ilanKaynagi.findMany({
    where: { tur: WHATSAPP_GRUP, durum: "ADAY" },
    orderBy: [{ oncelik: "desc" }, { id: "desc" }],
    take: 40,
    select: { id: true, ad: true, hedef: true, hasatKaynak: true },
  });
}

/** Takipteki (aktif) WhatsApp grupları: jid → kaynak id. */
export async function aktifWhatsappGruplari(): Promise<Map<string, number>> {
  const satirlar = await prisma.ilanKaynagi.findMany({
    where: { tur: WHATSAPP_GRUP, aktif: true, durum: "AKTIF" },
    select: { id: true, hedef: true },
  });
  return new Map(satirlar.map((s) => [s.hedef, s.id]));
}

/** Bağlantı açık: tarama nabzı. Mesaj gelmese de sonTarama dolar. */
export async function whatsappTaramaIsaretle(ids: number[]): Promise<void> {
  const temiz = [...new Set(ids.filter((id) => id > 0))];
  if (temiz.length === 0) return;
  await prisma.ilanKaynagi.updateMany({
    where: { id: { in: temiz } },
    data: { sonTarama: new Date() },
  });
}

type MesajIcerik = {
  conversation?: string | null;
  extendedTextMessage?: { text?: string | null } | null;
  imageMessage?: { caption?: string | null } | null;
  videoMessage?: { caption?: string | null } | null;
  documentMessage?: { caption?: string | null } | null;
  buttonsMessage?: { contentText?: string | null } | null;
  documentWithCaptionMessage?: { message?: MesajIcerik | null } | null;
  ephemeralMessage?: { message?: MesajIcerik | null } | null;
  viewOnceMessage?: { message?: MesajIcerik | null } | null;
  viewOnceMessageV2?: { message?: MesajIcerik | null } | null;
  viewOnceMessageV2Extension?: { message?: MesajIcerik | null } | null;
  editedMessage?: { message?: MesajIcerik | null } | null;
  templateMessage?: {
    hydratedTemplate?: { hydratedContentText?: string | null } | null;
    hydratedFourRowTemplate?: { hydratedContentText?: string | null } | null;
  } | null;
  highlyStructuredMessage?: {
    hydratedHsm?: { hydratedContentText?: string | null } | null;
  } | null;
  interactiveMessage?: {
    body?: { text?: string | null } | null;
    header?: { title?: string | null; subtitle?: string | null } | null;
  } | null;
  listMessage?: { description?: string | null; title?: string | null } | null;
};

/** Metin, uzun metin, kanal paylaşımı veya fotoğraf/video/belge açıklaması. */
export function whatsappMetni(m: MesajIcerik | null | undefined): string | null {
  if (!m) return null;
  const ic =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.viewOnceMessageV2Extension?.message ||
    m.editedMessage?.message ||
    m.documentWithCaptionMessage?.message;
  if (ic) return whatsappMetni(ic);
  const metin =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsMessage?.contentText ||
    m.templateMessage?.hydratedTemplate?.hydratedContentText ||
    m.templateMessage?.hydratedFourRowTemplate?.hydratedContentText ||
    m.highlyStructuredMessage?.hydratedHsm?.hydratedContentText ||
    m.interactiveMessage?.body?.text ||
    m.interactiveMessage?.header?.title ||
    m.listMessage?.description ||
    m.listMessage?.title;
  return metin?.trim() || null;
}

/**
 * Gönderenin numarası (05xxxxxxxxx). Yeni gruplarda katılımcı gizli kimlikle
 * (@lid) gelir; numara yalnızca alternatif alanda varsa bulunur.
 */
export function gonderenTelefonu(key: {
  participant?: string | null;
  participantAlt?: string;
}): string | null {
  for (const jid of [key.participantAlt, key.participant]) {
    if (!jid || !jid.endsWith("@s.whatsapp.net")) continue;
    const rakam = jid.split("@")[0].split(":")[0];
    if (/^905\d{9}$/.test(rakam)) return `0${rakam.slice(2)}`;
  }
  return null;
}

// --- Yurt dışı / kamyonet ağırlıklı gruplardan çıkış ---

const YURT_DISI_KALIP =
  /\b(romanya|gurcistan|bulgaristan|azerbaycan|baku|tiflis|poti|batum|rusya|moskova|iran|irak|erbil|suriye|yunanistan|almanya|avrupa|ukrayna|kazakistan|ozbekistan|turkmenistan|kirgizistan|tacikistan|afganistan|ihracat|ithalat|transit|gumruk|yurt ?disi|uluslararasi)\b/;
const KAMYONET_KALIP =
  /\b(kamyonet|panelvan|panel van|doblo|minivan|pikap|pickup|hafif ticari|kangoo|caddy|fiorino)\b/;
const CIKIS_GUN = 3;
const CIKIS_MIN_MESAJ = 15;
const CIKIS_ORAN = 0.6;
/** Bu kadardan fazla mesajı AI'den sorunsuz geçtiyse grup işe yarıyor: kalır. */
const CIKIS_MAX_YARAR = 2;
const CIKIS_GUNLUK = 2;
const CIKIS_SAYAC = "whatsapp_cikis_sayac";

export type WaCikisAdayi = { id: number; hedef: string; ad: string; oran: number; mesaj: number; yarar: number };

function yabanciBayrakVar(metin: string): boolean {
  return (metin.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) ?? []).some((b) => b !== "🇹🇷");
}

/**
 * Son 3 günde mesajlarının çoğu yurt dışı / kamyonet olan ve neredeyse hiç
 * işe yaramayan WhatsApp grupları. En az 3 gündür takipte olan gruplar.
 */
export async function waCikisAdaylari(): Promise<WaCikisAdayi[]> {
  const bas = new Date(Date.now() - CIKIS_GUN * 86_400_000);
  const kaynaklar = await prisma.ilanKaynagi.findMany({
    where: { tur: WHATSAPP_GRUP, aktif: true, durum: "AKTIF", createdAt: { lte: new Date(Date.now() - 86_400_000) } },
    select: { id: true, hedef: true, ad: true, createdAt: true },
  });
  const adaylar: WaCikisAdayi[] = [];
  for (const k of kaynaklar) {
    if (!k.hedef.includes("@")) continue;
    // Adı zaten "yurt dışı" diyorsa 1 gün / 5 mesaj yeter; diğerleri 3 gün / 15 mesaj
    const adYurtDisi = /\b(yurt ?disi|uluslararasi|international)\b/.test(sadelestir(k.ad));
    if (!adYurtDisi && k.createdAt > bas) continue;
    const ms = await prisma.hamMesaj.findMany({
      where: { kaynakId: k.id, createdAt: { gte: bas } },
      select: { metin: true, hata: true, islendi: true },
    });
    if (ms.length < (adYurtDisi ? 5 : CIKIS_MIN_MESAJ)) continue;
    const kotu = ms.filter((m) => {
      const s = sadelestir(m.metin);
      return YURT_DISI_KALIP.test(s) || yabanciBayrakVar(m.metin) || KAMYONET_KALIP.test(s);
    }).length;
    const yarar = ms.filter((m) => m.islendi && m.hata === null).length;
    const oran = kotu / ms.length;
    if (oran >= CIKIS_ORAN && yarar <= CIKIS_MAX_YARAR) {
      adaylar.push({ id: k.id, hedef: k.hedef, ad: k.ad, oran, mesaj: ms.length, yarar });
    }
  }
  return adaylar.sort((a, b) => b.oran - a.oran);
}

/** Bugün daha kaç gruptan çıkılabilir. */
export async function waCikisHakki(): Promise<number> {
  const bugun = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const k = await prisma.ayar.findUnique({ where: { anahtar: CIKIS_SAYAC } });
  try {
    const d = k?.deger ? (JSON.parse(k.deger) as { gun: string; adet: number }) : null;
    return CIKIS_GUNLUK - (d?.gun === bugun ? d.adet : 0);
  } catch {
    return CIKIS_GUNLUK;
  }
}

/** Çıkılan grup pasif olur; davet linki tekrar gelse de girilmez. */
export async function waCikildiIsaretle(aday: WaCikisAdayi): Promise<void> {
  const bugun = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const kalan = await waCikisHakki();
  const deger = JSON.stringify({ gun: bugun, adet: CIKIS_GUNLUK - kalan + 1 });
  await prisma.ayar.upsert({ where: { anahtar: CIKIS_SAYAC }, update: { deger }, create: { anahtar: CIKIS_SAYAC, deger } });
  await prisma.ilanKaynagi.update({
    where: { id: aday.id },
    data: {
      aktif: false,
      durum: "PASIF",
      sonHata: `Çıkıldı: 3 günde ${aday.mesaj} mesajın %${Math.round(aday.oran * 100)}'i yurt dışı/kamyonet`,
    },
  });
}

/** Davetteki grup daha önce çıkılmış (pasif) bir grup mu? */
export async function waPasifGrupMu(jid: string): Promise<boolean> {
  const k = await prisma.ilanKaynagi.findUnique({
    where: { tur_hedef: { tur: WHATSAPP_GRUP, hedef: jid } },
    select: { durum: true },
  });
  return k?.durum === "PASIF";
}
