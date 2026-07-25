import { GIDER_KATEGORILERI } from "@/lib/sabitler";

/**
 * Structured Outputs `strict: true` kuralları:
 * - her alan `required` içinde olmalı
 * - `additionalProperties: false` zorunlu
 * - opsiyonel alanlar `type: [..., "null"]` ile ifade edilir
 */

const metinVeyaBos = { type: ["string", "null"] };
const sayiVeyaBos = { type: ["number", "null"] };

export const ILAN_LISTESI_SEMASI: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["ilanlar"],
  properties: {
    ilanlar: {
      type: "array",
      description: "Metinde bulunan yük ilanları. İlan yoksa boş dizi.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "firmaAdi",
          "telefon",
          "nereden",
          "nereye",
          "cikisIl",
          "varisIl",
          "yuklemeTarihi",
          "ucretTl",
          "aracTipi",
          "yukTipi",
          "guvenSkoru",
        ],
        properties: {
          firmaAdi: { ...metinVeyaBos, description: "İlanı veren firma / kişi" },
          telefon: {
            ...metinVeyaBos,
            description: "Sadece rakamlar, mümkünse 05xxxxxxxxx biçiminde",
          },
          nereden: { ...metinVeyaBos, description: "Yükleme yeri, yazıldığı gibi" },
          nereye: { ...metinVeyaBos, description: "Boşaltma yeri, yazıldığı gibi" },
          cikisIl: { ...metinVeyaBos, description: "Yükleme ili (81 ilden biri)" },
          varisIl: { ...metinVeyaBos, description: "Boşaltma ili (81 ilden biri)" },
          yuklemeTarihi: {
            ...metinVeyaBos,
            description: "YYYY-MM-DD biçiminde; belirtilmemişse null",
          },
          ucretTl: {
            ...sayiVeyaBos,
            description: "Navlun bedeli TL cinsinden sayı; belirtilmemişse null",
          },
          aracTipi: { ...metinVeyaBos, description: "Tır, kırkayak, tenteli vb." },
          yukTipi: { ...metinVeyaBos, description: "Taşınacak malın cinsi" },
          guvenSkoru: {
            type: "integer",
            description:
              "0-100. Bunun gerçek bir yük ilanı olduğuna ve alanların doğruluğuna güven.",
          },
        },
      },
    },
  },
};

export type IlanCikti = {
  ilanlar: {
    firmaAdi: string | null;
    telefon: string | null;
    nereden: string | null;
    nereye: string | null;
    cikisIl: string | null;
    varisIl: string | null;
    yuklemeTarihi: string | null;
    ucretTl: number | null;
    aracTipi: string | null;
    yukTipi: string | null;
    guvenSkoru: number;
  }[];
};

const AKTIF_KATEGORILER = GIDER_KATEGORILERI.filter((k) => !k.eski).map(
  (k) => k.kod
);

export const FIS_SEMASI: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "okunabildi",
    "firmaAdi",
    "tarih",
    "toplamTutarTl",
    "kdvTutarTl",
    "kdvDahilMi",
    "kategori",
    "litre",
    "aciklama",
    "guvenSkoru",
  ],
  properties: {
    okunabildi: {
      type: "boolean",
      description: "Görselden fiş/fatura bilgisi okunabildi mi",
    },
    firmaAdi: { ...metinVeyaBos, description: "Fişi kesen firma" },
    tarih: { ...metinVeyaBos, description: "YYYY-MM-DD" },
    toplamTutarTl: {
      ...sayiVeyaBos,
      description: "Genel toplam (KDV dahil) TL cinsinden sayı",
    },
    kdvTutarTl: {
      ...sayiVeyaBos,
      description: "Fişte yazan KDV tutarı; yoksa null",
    },
    kdvDahilMi: {
      type: "boolean",
      description: "toplamTutarTl KDV dahil mi (genelde true)",
    },
    kategori: {
      type: "string",
      enum: AKTIF_KATEGORILER,
      description: "Harcamanın gider türü",
    },
    litre: {
      ...sayiVeyaBos,
      description: "Akaryakıt fişiyse litre miktarı; değilse null",
    },
    aciklama: {
      ...metinVeyaBos,
      description: "Kısa açıklama, örn. 'Opet - motorin'",
    },
    guvenSkoru: { type: "integer", description: "0-100 arası güven" },
  },
};

export type FisCikti = {
  okunabildi: boolean;
  firmaAdi: string | null;
  tarih: string | null;
  toplamTutarTl: number | null;
  kdvTutarTl: number | null;
  kdvDahilMi: boolean;
  kategori: string;
  litre: number | null;
  aciklama: string | null;
  guvenSkoru: number;
};

export const ADAY_FIRMA_SEMASI: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["firmalar"],
  properties: {
    firmalar: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "ad",
          "sehir",
          "ilce",
          "adres",
          "telefon",
          "web",
          "sektor",
          "neden",
          "skor",
        ],
        properties: {
          ad: { type: "string", description: "Firma ünvanı" },
          sehir: metinVeyaBos,
          ilce: metinVeyaBos,
          adres: metinVeyaBos,
          telefon: metinVeyaBos,
          web: metinVeyaBos,
          sektor: { ...metinVeyaBos, description: "Üretim / lojistik alanı" },
          neden: {
            ...metinVeyaBos,
            description: "Bu firma neden nakliye müşterisi olabilir",
          },
          skor: {
            type: "integer",
            description: "0-100 potansiyel müşteri olma ihtimali",
          },
        },
      },
    },
  },
};

export type AdayFirmaCikti = {
  firmalar: {
    ad: string;
    sehir: string | null;
    ilce: string | null;
    adres: string | null;
    telefon: string | null;
    web: string | null;
    sektor: string | null;
    neden: string | null;
    skor: number;
  }[];
};
