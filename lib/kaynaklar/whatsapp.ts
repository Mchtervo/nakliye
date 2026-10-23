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
  ephemeralMessage?: { message?: MesajIcerik | null } | null;
  viewOnceMessage?: { message?: MesajIcerik | null } | null;
  viewOnceMessageV2?: { message?: MesajIcerik | null } | null;
};

/** Metin, uzun metin veya fotoğraf/video/belge açıklaması. */
export function whatsappMetni(m: MesajIcerik | null | undefined): string | null {
  if (!m) return null;
  const ic = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message;
  if (ic) return whatsappMetni(ic);
  const metin =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption;
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
