import { GIDER_KATEGORILERI } from "@/lib/sabitler";

/**
 * Structured Outputs `strict: true` kuralları:
 * - her alan `required` içinde olmalı
 * - `additionalProperties: false` zorunlu
 * - opsiyonel alanlar `type: [..., "null"]` ile ifade edilir
 */

const metinVeyaBos = { type: ["string", "null"] };
const sayiVeyaBos = { type: ["number", "null"] };

const ILAN_ALANLARI: Record<string, unknown> = {
  firmaAdi: {
    ...metinVeyaBos,
    description:
      "Şirket adı (… Lojistik, … Nakliyat, Ltd). Kişi adı yazma — ilgiliKisi'ye yaz.",
  },
  ilgiliKisi: {
    ...metinVeyaBos,
    description: "İlgili kişi adı (Ulviye, Mehmet). Şirket adı değil. Yoksa null.",
  },
  telefon: {
    ...metinVeyaBos,
    description:
      "Sadece rakamlar (05xxxxxxxxx). Metinde İRT/İRTİBAT/TEL: varsa ONU yaz — paylaşanın değil irtibat numarası.",
  },
  nereden: {
    ...metinVeyaBos,
    description:
      "Yükleme yeri (il/ilçe), METİNDE GEÇTİĞİ GİBİ ve AYNI satırdaki varışla. Araç/firma adı YAZMA. Yoksa null.",
  },
  nereye: {
    ...metinVeyaBos,
    description:
      "Boşaltma yeri (il/ilçe), METİNDE GEÇTİĞİ GİBİ ve AYNI satırdaki çıkışla. Kırkayak/damper/firma adı YAZMA. Yoksa null.",
  },
  yuklemeTarihi: {
    ...metinVeyaBos,
    description: "YYYY-MM-DD biçiminde; belirtilmemişse null",
  },
  ucretTl: {
    ...sayiVeyaBos,
    description: "Fiyat, TL cinsinden sade sayı; belirtilmemişse null",
  },
  ucretTuru: {
    type: "string",
    enum: ["TON_BASI", "KOMPLE", "BELIRSIZ"],
    description:
      "ucretTl ton başı mı komple navlun mu. Anlaşılmıyorsa BELIRSIZ.",
  },
  tonaj: {
    ...sayiVeyaBos,
    description:
      "Yükün ton cinsinden ağırlığı (ör. 24). Araç adedi değildir. Yoksa null.",
  },
  aracTipi: {
    ...metinVeyaBos,
    description:
      "tenteli, damper, frigo, kırkayak, lowbed, kısadorse vb. — yer adı değil",
  },
  yukTipi: { ...metinVeyaBos, description: "Taşınacak malın cinsi" },
  guvenSkoru: {
    type: "integer",
    description:
      "0-100. Bunun gerçek bir yük ilanı olduğuna ve alanların doğruluğuna güven.",
  },
};

const ILAN_ZORUNLU = Object.keys(ILAN_ALANLARI);

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
        required: ILAN_ZORUNLU,
        properties: ILAN_ALANLARI,
      },
    },
  },
};

export type IlanCikti = {
  ilanlar: {
    firmaAdi: string | null;
    ilgiliKisi: string | null;
    telefon: string | null;
    nereden: string | null;
    nereye: string | null;
    yuklemeTarihi: string | null;
    ucretTl: number | null;
    ucretTuru: "TON_BASI" | "KOMPLE" | "BELIRSIZ";
    tonaj: number | null;
    aracTipi: string | null;
    yukTipi: string | null;
    guvenSkoru: number;
  }[];
};

/**
 * Numaralanmış mesaj yığınından ilan çıkarır. Her ilan hangi mesajdan
 * geldiğini söyler; tekrar kontrolü ve ham metin eşlemesi buna dayanır.
 */
export const MESAJ_ILAN_SEMASI: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["ilanlar"],
  properties: {
    ilanlar: {
      type: "array",
      description: "Mesajlarda bulunan yük ilanları. İlan yoksa boş dizi.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["mesajNo", ...ILAN_ZORUNLU],
        properties: {
          mesajNo: {
            type: "integer",
            description: "İlanın alındığı mesajın köşeli parantezdeki numarası",
          },
          ...ILAN_ALANLARI,
        },
      },
    },
  },
};

export type MesajIlanCikti = {
  ilanlar: (IlanCikti["ilanlar"][number] & { mesajNo: number })[];
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
