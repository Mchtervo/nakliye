/**
 * AI çağrısından ÖNCE ucuz dedup: telefon + rota (il çifti).
 * Komisyoncu aynı listeyi saat başı atınca OpenAI'ye gitmeden elenir.
 */
import { prisma } from "@/lib/prisma";
import { ilBul, illeriBul } from "@/lib/iller";
import { DEDUP_PENCERE_MS } from "@/lib/kaynaklar/kaydet";
import {
  ortakBaglamSatirlari,
  rotaSatiriMi,
  satirlaraBol,
} from "@/lib/kaynaklar/onFiltre";

export type HamRota = {
  cikisIl: string;
  varisIl: string;
  satir: string;
};

/** Metindeki cep telefonlarını 05xxxxxxxxx biçimine çevirir. */
export function telefonlariCikar(metin: string): string[] {
  const eslesmeler =
    metin.match(/(\+?90|0)\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g) ||
    [];
  const sonuc = new Set<string>();
  for (const ham of eslesmeler) {
    const r = telefonNormalize(ham);
    if (r) sonuc.add(r);
  }
  return [...sonuc];
}

/** 05xxxxxxxxx biçimine çevir; geçersizse null. */
export function telefonNormalize(ham: string | null | undefined): string | null {
  if (!ham) return null;
  let r = ham.replace(/\D/g, "");
  if (r.length < 10) return null;
  if (r.startsWith("90") && r.length >= 12) r = `0${r.slice(2)}`;
  if (r.length === 10) r = `0${r}`;
  if (r.length === 13 && r.startsWith("090")) r = `0${r.slice(3)}`;
  if (r.length >= 11 && r.startsWith("05")) return r.slice(0, 11);
  return null;
}

/**
 * Mesajda İRT / irtibat / iletişim etiketiyle yazılan numarayı bul.
 * Paylaşanın (Telegram) numarası değil — ilandaki irtibat tercih edilir.
 */
export function irtibatTelefonuBul(metin: string): string | null {
  if (!metin) return null;

  // Kelime başı: "otel 05..." yanlış eşleşmesin
  const etiket =
    /(?:^|[\s,;|/(\[{\n])(?:İRTİBAT|IRTIBAT|İRT|IRT|İLETİŞİM|ILETISIM|İLETISIM|TELEFON|TEL|GSM|CEP|WHATSAPP|WP)\s*[:：.\-]?\s*((?:\+?90|0)\s*5\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2})/gi;

  let m: RegExpExecArray | null;
  while ((m = etiket.exec(metin)) !== null) {
    const t = telefonNormalize(m[1]);
    if (t) return t;
  }

  // Sadeleştirilmiş metin: "irt 0543..."
  const sade = metin
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
  const sadeEs =
    /(?:^|[^a-z0-9])(?:irtibat|irt|iletisim|telefon|tel|gsm|cep|whatsapp|wp)\s*[:.\-]?\s*((?:0|90)?5\d{9,10})/i.exec(
      sade
    );
  if (sadeEs?.[1]) {
    const t = telefonNormalize(sadeEs[1]);
    if (t) return t;
  }

  return null;
}

/**
 * AI'siz rota çiftleri. Satırda 2 il → çıkış/varış.
 * Tek il + başlıkta ortak çıkış (ÇAN'DAN / MANİSA…) → ortak→varış.
 */
export function hamRotalariCikar(metin: string): HamRota[] {
  const satirlar = satirlaraBol(metin);
  if (satirlar.length === 0) return [];

  const baglamMetin = satirlar.filter((s) => !rotaSatiriMi(s)).join("\n");
  const baglamIller = illeriBul(baglamMetin);
  const tumIller = illeriBul(metin);
  const ortakCikis = baglamIller[0] || tumIller[0] || null;

  const sonuc: HamRota[] = [];
  const gorulen = new Set<string>();

  for (const satir of satirlar) {
    if (!rotaSatiriMi(satir)) continue;
    const iller = illeriBul(satir);
    let cikis: string | null = null;
    let varis: string | null = null;

    if (iller.length >= 2) {
      cikis = iller[0];
      varis = iller[iller.length - 1];
    } else if (iller.length === 1 && ortakCikis && iller[0] !== ortakCikis) {
      cikis = ortakCikis;
      varis = iller[0];
    } else {
      continue;
    }

    // "Manisa → Esenyurt" — Esenyurt ilçe → İstanbul
    const cIl = ilBul(cikis) || cikis;
    const vIl = ilBul(varis) || varis;
    if (!cIl || !vIl || cIl === vIl) continue;

    const anahtar = `${cIl}|${vIl}`;
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    sonuc.push({ cikisIl: cIl, varisIl: vIl, satir });
  }

  return sonuc;
}

async function rotaKayitliMi(
  cikisIl: string,
  varisIl: string,
  telefonlar: string[],
  sinir: Date
): Promise<{ id: number } | null> {
  const telFiltre =
    telefonlar.length === 1
      ? { telefon: telefonlar[0] }
      : telefonlar.length > 1
        ? { telefon: { in: telefonlar } }
        : {};

  return prisma.yukIlani.findFirst({
    where: {
      cikisIl,
      varisIl,
      sonGorulme: { gte: sinir },
      ...telFiltre,
    },
    orderBy: { sonGorulme: "desc" },
    select: { id: true },
  });
}

/** Eşleşen ilanların sonGorulme'sini şimdiye çeker. */
export async function sonGorulmeleriYenile(
  idler: number[]
): Promise<number> {
  if (idler.length === 0) return 0;
  const r = await prisma.yukIlani.updateMany({
    where: { id: { in: idler } },
    data: { sonGorulme: new Date() },
  });
  return r.count;
}

export type AiOncesiSonuc =
  | {
      tur: "atla";
      /** Güncellenen YukIlani id'leri */
      yenilenen: number[];
      rotaSayisi: number;
    }
  | {
      tur: "ai";
      /** AI'ye gidecek metin (kısmi yeni rotalar veya tam) */
      metin: string;
      /** Zaten bilinen rotalar — sonGorulme güncelle */
      yenilenen: number[];
      yeniRota: number;
      eskiRota: number;
    };

/**
 * Mesaj AI'ye gitmeden önce:
 * - Tüm rotalar 48s kayıtlı → atla (AI yok)
 * - Kısmi yeni → sadece yeni satırlar + bağlam
 * - Rota çıkarılamadı / hepsi yeni → tam metin
 */
export async function aiOncesiHazirla(metin: string): Promise<AiOncesiSonuc> {
  const telefonlar = telefonlariCikar(metin);
  const rotalar = hamRotalariCikar(metin);
  const sinir = new Date(Date.now() - DEDUP_PENCERE_MS);

  if (rotalar.length === 0) {
    return { tur: "ai", metin, yenilenen: [], yeniRota: 0, eskiRota: 0 };
  }

  const yeni: HamRota[] = [];
  const yenilenen: number[] = [];

  for (const r of rotalar) {
    const kayit = await rotaKayitliMi(
      r.cikisIl,
      r.varisIl,
      telefonlar,
      sinir
    );
    if (kayit) yenilenen.push(kayit.id);
    else yeni.push(r);
  }

  if (yeni.length === 0) {
    return {
      tur: "atla",
      yenilenen: [...new Set(yenilenen)],
      rotaSayisi: rotalar.length,
    };
  }

  if (yeni.length === rotalar.length) {
    return {
      tur: "ai",
      metin,
      yenilenen: [],
      yeniRota: yeni.length,
      eskiRota: 0,
    };
  }

  // Kısmi: ortak bağlam + sadece yeni rota satırları
  const baglam = ortakBaglamSatirlari(metin);
  const parca = [
    ...baglam,
    baglam.length
      ? "(Yukarıdaki firma/telefon bu listedeki güzergahlar için ortaktır. Sadece YENİ satırlar.)"
      : null,
    ...yeni.map((r) => r.satir),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    tur: "ai",
    metin: parca,
    yenilenen: [...new Set(yenilenen)],
    yeniRota: yeni.length,
    eskiRota: rotalar.length - yeni.length,
  };
}
