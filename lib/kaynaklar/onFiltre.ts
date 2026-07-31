import { createHash } from "node:crypto";
import { illeriBul, sadelestir } from "@/lib/iller";

/**
 * AI'a gitmeden önce mesajı eleyen ucuz kontroller.
 * Asıl maliyet tasarrufu burada: elenen mesaj hiç token harcamaz.
 */

/** Yük ilanı olmayan ama şehir adı geçen / çöp mesajlar. */
const SPAM_KALIPLARI = [
  "evden eve", "ev tasima", "parca esya", "asansorlu", "ceyiz",
  "ogrenci tasima", "personel servis", "oto kurtarma", "cekici hizmet",
  "kurye", "moto kurye", "arac araniyor", "araclar araniyor",
  "surucu araniyor", "sofor araniyor", "eleman araniyor", "is ilani",
  "kanalimiza katil", "gruba davet", "reklam", "sponsor",
  "ensest", "ifsa", "sanal yok", "escort", "gizli numara", "sohbet hatti",
  "kripto", "bitcoin", "forex", "bahis", "iddaa", "casino",
  // Eskort / saatlik-gecelik
  "saatlik", "gecelik", "saatlik yada", "gecelik yada",
  "vip bayan", "masoz", "otel oda", "resepsiyon",
  // Boşta şoför / elden ödeme spam
  "musaitiz", "müsaitiz", "arkadasiz", "arkadaşız", "elden odeme",
  "elden ödeme", "yazz", "yazın abiler",
  // Evden eve hizmet reklamı (nakliyat firması tanıtımı)
  "7/24", "724 evden", "asansorlu tasima",
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

/** metinHash tekrar penceresi — dedupHash 48s kova ile aynı mantık. */
export const METIN_HASH_PENCERE_MS = 48 * 60 * 60 * 1000;

/**
 * Metnin birebir tekrar anahtarı.
 * 48s kova: süre dolunca aynı metin yeniden kuyruğa girebilir
 * (firma her gün aynı ilanı atar).
 */
export function metinHashUret(metin: string, zaman = new Date()): string {
  const kova = Math.floor(zaman.getTime() / METIN_HASH_PENCERE_MS);
  return createHash("sha1")
    .update(`b${kova}|${sadelestir(metin)}`)
    .digest("hex")
    .slice(0, 32);
}

/** Tek satırın tekrarını yakalamak için. */
export function satirHashUret(satir: string): string {
  return createHash("sha1").update(sadelestir(satir)).digest("hex").slice(0, 32);
}

function spamMi(sade: string): boolean {
  return SPAM_KALIPLARI.some((k) => sade.includes(sadelestir(k)));
}

/** Rota / fiyat / telefon / araç — ilan sinyali (keşif + budama paylaşır). */
export function ilanSinyaliVarMi(metin: string): boolean {
  return (
    ROTA_ISARETI.test(metin) ||
    FIYAT_ISARETI.test(metin) ||
    TELEFON_ISARETI.test(metin) ||
    ARAC_ISARETI.test(metin)
  );
}

/** Metin listesinde ilan sinyali oranı (0–1). */
export function ilanSinyalOrani(metinler: string[]): number {
  const dolu = metinler.map((m) => m.trim()).filter(Boolean);
  if (dolu.length === 0) return 0;
  const hit = dolu.filter((m) => ilanSinyaliVarMi(m)).length;
  return hit / dolu.length;
}

/** Kısa mesaj eşiği. Telefondaysa uzunluk yok sayılır. */
const KISA_ESIK = 25;

/**
 * Mesaj AI'a gönderilmeli mi? Gönderilmemeliyse sebebini döndürür.
 * `hedefIller` boşsa bölge kontrolü yapılmaz.
 *
 * `illeriBul` ilçe/semt takma adlarını da çözer (Ostim→Ankara, Gebze→Kocaeli).
 * Tablo tutmazsa bile rota/telefon/araç sinyali varsa ELEME — AI karar versin;
 * yanlış eleme, gereksiz AI çağrısından pahalıdır.
 */
export function elemeSebebi(metin: string, hedefIller: Set<string>): ElemeSebebi {
  const ham = metin.trim();
  const telefonVar = TELEFON_ISARETI.test(ham);
  const sade = sadelestir(ham);

  // Spam önce — kısa eskort/hizmet reklamı IL_YOK/KISA'ya düşmesin
  if (spamMi(sade)) return "SPAM";

  if (ham.length > 3000) return "KISA";
  // Telefon VEYA rota/fiyat/araç sinyali varsa kısa olsa da kuyruğa
  if (ham.length < KISA_ESIK && !telefonVar && !ilanSinyaliVarMi(ham)) {
    return "KISA";
  }

  const iller = illeriBul(ham);
  const sinyal = ilanSinyaliVarMi(ham);

  if (iller.length === 0) {
    // İlçe tablosu kaçırdıysa / bilinmeyen yer — şüpheliyse kuyruğa
    if (sinyal) return null;
    return "IL_YOK";
  }

  if (!sinyal) return "SINYAL_YOK";

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
  // Ortak çıkış listeleri: "EDREMİT TIR", "ADANA KAPALI TIR" (tek il + araç)
  // → rota say ki DÜZCE YÜKLEMELİ + satır varış istisnası çalışsın.
  if (
    illeriBul(satir).length === 1 &&
    /\b(tir|tır|kamyon|kamyonet|dorse|tenteli|kapali|frigo|kirkayak|10\s*teker)\b/i.test(
      sade
    )
  ) {
    return true;
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
 * Firma / telefon / tarih / başlık — her rota parçasına yeniden eklenir.
 * Girdi ucuz; telefonsuz rota işe yaramaz.
 */
export function ortakBaglamSatirlari(metin: string): string[] {
  const satirlar = satirlaraBol(metin);
  const baglam: string[] = [];
  for (const satir of satirlar) {
    if (rotaSatiriMi(satir)) continue;
    baglam.push(satir);
  }

  // Telefondan satır kaçmışsa (emoji satırı vs.) regex ile zorla ekle.
  const telefonlar = metin.match(
    /(\+?90|0)\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g
  );
  if (telefonlar) {
    for (const t of telefonlar) {
      const sade = t.replace(/\D/g, "").slice(-10);
      if (!baglam.some((b) => b.replace(/\D/g, "").includes(sade))) {
        baglam.push(t.trim());
      }
    }
  }

  // En fazla 10 bağlam satırı — başlık + firma + tel + tarih yeter.
  return baglam.slice(0, 10);
}

/**
 * Komisyoncu listesini AI çağrılarına böler: ortak bağlam +
 * en fazla `maxRota` rota. 30 rotalık mesaj → 6 çağrı; her çağrıda
 * telefon/firma tekrar gider.
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

  const rotalar = satirlar.filter(rotaSatiriMi);
  if (rotalar.length === 0) return [ham];
  if (rotalar.length <= limit) return [ham];

  const baslik = ortakBaglamSatirlari(ham);
  const parcalar: string[] = [];
  for (let i = 0; i < rotalar.length; i += limit) {
    const dilim = rotalar.slice(i, i + limit);
    parcalar.push(
      [
        ...baslik,
        baslik.length
          ? "(Yukarıdaki firma/telefon/tarih bu listedeki tüm güzergahlar için ortaktır.)"
          : null,
        ...dilim,
      ]
        .filter(Boolean)
        .join("\n")
    );
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

  const yeniRotalar: string[] = [];
  const yeniHashler: string[] = [];
  let atlanan = 0;

  for (const satir of satirlar) {
    if (!rotaSatiriMi(satir)) continue;
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

  const baslik = ortakBaglamSatirlari(metin);
  return {
    metin: [...baslik, ...yeniRotalar].join("\n"),
    yeniHashler,
    atlanan,
  };
}
