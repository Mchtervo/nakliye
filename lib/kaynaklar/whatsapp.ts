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
  /(?:https?:\/\/)?(?:chat\.whatsapp\.com|whatsapp\.com\/channel)\/([A-Za-z0-9_\-]+)/gi;

export function whatsappDavetKodlari(metin: string): string[] {
  const kodlar: string[] = [];
  const gorulen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(WA_DAVET_KALIP.source, "gi");
  while ((m = re.exec(metin)) !== null) {
    const kod = m[1];
    if (!kod || gorulen.has(kod)) continue;
    gorulen.add(kod);
    kodlar.push(kod);
  }
  return kodlar;
}

export function whatsappDavetUrl(kod: string): string {
  return `https://chat.whatsapp.com/${kod}`;
}

/** Herkese açık, Ankara/koridor civarı davetler. Sanal numara günde birkaçına kendi girer. */
const BILINEN_DAVETLER = [
  "BW9NmtsjshxE0Cq5xTqZ7V",
  "EWeW56jhh0IHvpADg8bMs8",
  "CKAnkHWFL6rKOd99ZliDmt",
  "lphp40x2a9jhyq8s0mrnfu",
];

export async function bilinenDavetleriYaz(): Promise<void> {
  for (const kod of BILINEN_DAVETLER) {
    await whatsappDavetiniKaydet(kod, "Açık davet").catch(() => null);
  }
}

const KATILIM_ANAHTAR = "whatsapp_katilim_sayac";
const KATILIM_GUNLUK = 4;

function bugunTr(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Sanal numara bir günde en fazla 4 gruba girer; fazlası yasak yer. */
export async function katilimHakkiVarMi(): Promise<boolean> {
  const kayit = await prisma.ayar.findUnique({ where: { anahtar: KATILIM_ANAHTAR } });
  if (!kayit) return true;
  try {
    const j = JSON.parse(kayit.deger) as { gun?: string; adet?: number };
    if (j.gun !== bugunTr()) return true;
    return (j.adet ?? 0) < KATILIM_GUNLUK;
  } catch {
    return true;
  }
}

export async function katilimHakkiKullan(): Promise<void> {
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
    },
    orderBy: [{ oncelik: "desc" }, { id: "asc" }],
    select: { id: true, hedef: true },
  });
  if (!aday) return null;
  const kod = aday.hedef.split("/").pop()?.split("?")[0] || "";
  if (!kod) return null;
  return { id: aday.id, kod };
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
  hasatKaynak: string
): Promise<"yeni" | "mevcut"> {
  const hedef = whatsappDavetUrl(kod);
  const varOlan = await prisma.ilanKaynagi.findUnique({
    where: { tur_hedef: { tur: WHATSAPP_GRUP, hedef } },
    select: { id: true },
  });
  if (varOlan) return "mevcut";
  await prisma.ilanKaynagi.create({
    data: {
      tur: WHATSAPP_GRUP,
      hedef,
      ad: `WA davet ${kod.slice(0, 10)}`,
      aktif: false,
      durum: "ADAY",
      oncelik: 12,
      hasatKaynak: hasatKaynak.slice(0, 120),
      sonHata: "Sırada — numara günde en fazla 4 gruba kendi girer",
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
  for (const kod of whatsappDavetKodlari(metin)) {
    try {
      const s = await whatsappDavetiniKaydet(kod, hasatKaynak);
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
    m.buttonsMessage?.contentText;
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
