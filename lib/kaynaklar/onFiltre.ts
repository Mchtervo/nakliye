import { createHash } from "node:crypto";
import { illeriBul, sadelestir } from "@/lib/iller";

/**
 * AI'a gitmeden önce mesajı eleyen ucuz kontroller.
 * Asıl maliyet tasarrufu burada: elenen mesaj hiç token harcamaz.
 */

/** Yük ilanı olmayan ama şehir adı geçen mesajlar. */
const SPAM_KALIPLARI = [
  "evden eve", "ev tasima", "parca esya", "asansorlu", "ceyiz",
  "ogrenci tasima", "personel servis", "oto kurtarma", "cekici hizmet",
  "kurye", "moto kurye", "arac araniyor", "araclar araniyor",
  "surucu araniyor", "sofor araniyor", "eleman araniyor", "is ilani",
  "kanalimiza katil", "gruba davet", "reklam", "sponsor",
  "ensest", "ifsa", "sanal yok", "escort", "gizli numara", "sohbet hatti",
  "kripto", "bitcoin", "forex", "bahis", "iddaa", "casino",
];

/** İlan sinyali: rota / fiyat / telefon / araç tipi. */
const ROTA_ISARETI =
  /[→➡➜▶️►\->]|(\b(den|dan|ten|tan|nereye|nereden)\b)|(\/\s*[a-zçğıöşü])/i;
const FIYAT_ISARETI =
  /(\d{3,})\s*(\+|tl|₺|kdv)|(\/\s*ton)|(\b(komple|navlun|bin)\b)/i;
const TELEFON_ISARETI = /(\+?90|0)\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/;
const ARAC_ISARETI =
  /\b(tenteli|frigo|damper|lowbed|kamyon|kamyonet|tir|tır|dorse|sal\b|kirkayak)/i;

export type ElemeSebebi =
  | "KISA"
  | "SPAM"
  | "IL_YOK"
  | "SINYAL_YOK"
  | "BOLGE_DISI"
  | "SATIR_TEKRAR"
  | "TEKRAR"
  | null;

/** Metnin birebir tekrarını yakalamak için kullanılan anahtar. */
export function metinHashUret(metin: string): string {
  return createHash("sha1").update(sadelestir(metin)).digest("hex").slice(0, 32);
}

/** Tek satırın tekrarını yakalamak için. */
export function satirHashUret(satir: string): string {
  return createHash("sha1").update(sadelestir(satir)).digest("hex").slice(0, 32);
}

function spamMi(sade: string): boolean {
  return SPAM_KALIPLARI.some((k) => sade.includes(k));
}

function ilanSinyaliVarMi(metin: string): boolean {
  return (
    ROTA_ISARETI.test(metin) ||
    FIYAT_ISARETI.test(metin) ||
    TELEFON_ISARETI.test(metin) ||
    ARAC_ISARETI.test(metin)
  );
}

/**
 * Mesaj AI'a gönderilmeli mi? Gönderilmemeliyse sebebini döndürür.
 * `hedefIller` boşsa bölge kontrolü yapılmaz.
 */
export function elemeSebebi(metin: string, hedefIller: Set<string>): ElemeSebebi {
  const ham = metin.trim();
  if (ham.length < 15 || ham.length > 3000) return "KISA";

  const sade = sadelestir(ham);
  if (spamMi(sade)) return "SPAM";

  const iller = illeriBul(ham);
  if (iller.length === 0) return "IL_YOK";

  if (!ilanSinyaliVarMi(ham)) return "SINYAL_YOK";

  if (hedefIller.size > 0 && !iller.some((il) => hedefIller.has(il))) {
    return "BOLGE_DISI";
  }
  return null;
}

/**
 * Mesajı satırlara böler. Emoji/bullet ile başlayan parçalar da satır sayılır.
 * Boş ve çok kısa satırlar atılır.
 */
export function satirlaraBol(metin: string): string[] {
  // Satır sonu yoksa emoji/bullet başlarını da ayırıcı say.
  const parcalar = metin
    .replace(/([📍🚛🚚⛔✨⭐🟡🔴🏀✈️▶️👉•●▪])/g, "\n$1")
    .split("\n");
  return parcalar.map((s) => s.trim()).filter((s) => s.length >= 6);
}

/**
 * Rota satırı gibi görünenler. Bunlar satır hash ile tekrar kontrol edilir.
 * Başlık / telefon / firma satırları bağlam olarak her zaman korunur.
 */
export function rotaSatiriMi(satir: string): boolean {
  const sade = sadelestir(satir);
  if (sade.length < 6) return false;
  // Fiyat + yer veya ok işareti içeren satırlar rota adayıdır.
  if (FIYAT_ISARETI.test(satir) && illeriBul(satir).length > 0) return true;
  if (/[→➡➜▶️►]/.test(satir) && illeriBul(satir).length > 0) return true;
  // "VAN 2400+" gibi kısa fiyat satırları. Telefon (05xx...) yakalanmasın
  // diye sayı 3-4 hane ve satır sonunda (veya + ile) bitmeli.
  if (
    /^[A-ZÇĞİÖŞÜa-zçğıöşü.\s]{2,40}\s+(?!5)\d{3,4}\+?\s*$/i.test(satir.trim())
  ) {
    return illeriBul(satir).length > 0;
  }
  return false;
}

/** Bir AI çağrısına en fazla bu kadar rota satırı gider (FAZ 1 maliyet). */
export const AI_MAX_ROTA_PARCA = Number(process.env.AI_MAX_ROTA_PARCA || 5);

/** Mesajdaki rota satırı adedi; rota yoksa düz metin = 1 birim. */
export function rotaSatirSayisi(metin: string): number {
  const n = satirlaraBol(metin).filter(rotaSatiriMi).length;
  return n > 0 ? n : 1;
}

/**
 * Komisyoncu listesini AI çağrılarına böler: bağlam (başlık/telefon) +
 * en fazla `maxRota` yeni rota satırı. 30 rotalık mesaj → 6 çağrı.
 */
export function mesajiAiParcalarinaBol(
  metin: string,
  maxRota = AI_MAX_ROTA_PARCA
): string[] {
  const ham = metin.trim();
  if (!ham) return [];
  const limit = Math.max(1, Math.floor(maxRota) || 5);
  const satirlar = satirlaraBol(ham);
  if (satirlar.length === 0) return [ham];

  const baglam: string[] = [];
  const rotalar: string[] = [];
  for (const satir of satirlar) {
    if (rotaSatiriMi(satir)) rotalar.push(satir);
    else baglam.push(satir);
  }

  if (rotalar.length === 0) return [ham];
  if (rotalar.length <= limit) return [ham];

  const baslik = baglam.slice(0, 4);
  const parcalar: string[] = [];
  for (let i = 0; i < rotalar.length; i += limit) {
    parcalar.push([...baslik, ...rotalar.slice(i, i + limit)].join("\n"));
  }
  return parcalar;
}

/** Mesajdaki rota satırlarının hash listesi (DB sorgusu için). */
export function rotaHashleri(metin: string): string[] {
  const sonuc: string[] = [];
  let rotaVar = false;
  for (const satir of satirlaraBol(metin)) {
    if (!rotaSatiriMi(satir)) continue;
    rotaVar = true;
    sonuc.push(satirHashUret(satir));
  }
  if (!rotaVar) sonuc.push(metinHashUret(metin));
  return [...new Set(sonuc)];
}

/**
 * Daha önce görülmüş rota satırlarını çıkarır.
 * Bağlam satırları (başlık, telefon) korunur ki AI çıkış yerini kaybetmesin.
 * Yeni rota yoksa `metin` boş döner → mesaj kuyruğa alınmaz.
 */
export function yeniSatirlariSec(
  metin: string,
  bilinenHashler: Set<string>
): { metin: string; yeniHashler: string[]; atlanan: number } {
  const satirlar = satirlaraBol(metin);
  if (satirlar.length === 0) {
    return { metin: metin.trim(), yeniHashler: [], atlanan: 0 };
  }

  const baglam: string[] = [];
  const yeniRotalar: string[] = [];
  const yeniHashler: string[] = [];
  let atlanan = 0;

  for (const satir of satirlar) {
    if (!rotaSatiriMi(satir)) {
      baglam.push(satir);
      continue;
    }
    const hash = satirHashUret(satir);
    if (bilinenHashler.has(hash)) {
      atlanan += 1;
      continue;
    }
    yeniRotalar.push(satir);
    yeniHashler.push(hash);
  }

  // Hiç rota satırı yoksa (tek güzergahlı düz metin) tüm mesajı hash'le.
  if (yeniRotalar.length === 0 && atlanan === 0) {
    const hash = metinHashUret(metin);
    if (bilinenHashler.has(hash)) {
      return { metin: "", yeniHashler: [], atlanan: 1 };
    }
    return { metin: metin.trim(), yeniHashler: [hash], atlanan: 0 };
  }

  if (yeniRotalar.length === 0) {
    return { metin: "", yeniHashler: [], atlanan };
  }

  // Bağlamı kısalt: ilk 4 satır yeter (firma + çıkış + telefon).
  const baslik = baglam.slice(0, 4);
  return {
    metin: [...baslik, ...yeniRotalar].join("\n"),
    yeniHashler,
    atlanan,
  };
}
