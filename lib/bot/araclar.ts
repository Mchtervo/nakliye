import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import { bugunAnahtar, elemeSayaclariOku } from "@/lib/kaynaklar/elemeSayac";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import { SUPHE_SINIRI } from "@/lib/kaynaklar/filtre";
import type { KartIlan } from "@/lib/bot/kart";

export type IlanAraGirdi = {
  cikisIl?: string | null;
  varisIl?: string | null;
  aracTipi?: string | null;
  maxTonaj?: number | null;
  sonSaat?: number | null;
  limit?: number | null;
};

function kartYap(i: {
  id: number;
  nereden: string | null;
  nereye: string | null;
  cikisIl: string | null;
  varisIl: string | null;
  tonaj: number | null;
  aracTipi: string | null;
  yukTipi: string | null;
  yuklemeTarihi: Date | null;
  ucret: number | null;
  fiyatTon: number | null;
  fiyatBelirsiz: boolean;
  telefon: string | null;
  firmaAdi: string | null;
  guvenSkoru: number;
  createdAt: Date;
  kaynak: { ad: string } | null;
}): KartIlan {
  return {
    id: i.id,
    nereden: i.nereden,
    nereye: i.nereye,
    cikisIl: i.cikisIl,
    varisIl: i.varisIl,
    tonaj: i.tonaj,
    aracTipi: i.aracTipi,
    yukTipi: i.yukTipi,
    yuklemeTarihi: i.yuklemeTarihi,
    ucret: i.ucret,
    fiyatTon: i.fiyatTon,
    fiyatBelirsiz: i.fiyatBelirsiz,
    telefon: i.telefon,
    firmaAdi: i.firmaAdi,
    guvenSkoru: i.guvenSkoru,
    createdAt: i.createdAt,
    kaynakAd: i.kaynak?.ad ?? null,
  };
}

/** OpenAI function: ilanAra */
export async function ilanAra(girdi: IlanAraGirdi): Promise<{
  toplam: number;
  ilanlar: KartIlan[];
}> {
  const limit = Math.min(Math.max(Number(girdi.limit) || 5, 1), 5);
  const sonSaat = Math.min(Math.max(Number(girdi.sonSaat) || 48, 1), 168);
  const since = new Date(Date.now() - sonSaat * 60 * 60 * 1000);

  const cikis = girdi.cikisIl ? ilBul(girdi.cikisIl) : null;
  const varis = girdi.varisIl ? ilBul(girdi.varisIl) : null;

  const where: Record<string, unknown> = {
    createdAt: { gte: since },
    guvenSkoru: { gte: SUPHE_SINIRI },
    durum: { not: "ELENDI" },
  };
  if (cikis) where.cikisIl = cikis;
  if (varis) where.varisIl = varis;
  if (girdi.maxTonaj) {
    where.OR = [{ tonaj: null }, { tonaj: { lte: Number(girdi.maxTonaj) } }];
  }
  if (girdi.aracTipi?.trim()) {
    where.aracTipi = { contains: girdi.aracTipi.trim(), mode: "insensitive" };
  }

  const [toplam, satirlar] = await Promise.all([
    prisma.yukIlani.count({ where }),
    prisma.yukIlani.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { kaynak: { select: { ad: true } } },
    }),
  ]);

  return { toplam, ilanlar: satirlar.map(kartYap) };
}

/** OpenAI function: hamMesajAra */
export async function hamMesajAra(
  metin: string,
  sonSaat = 48
): Promise<{ adet: number; ornekler: { id: number; metin: string; zaman: string }[] }> {
  const q = metin.trim().slice(0, 80);
  if (q.length < 2) return { adet: 0, ornekler: [] };
  const since = new Date(
    Date.now() - Math.min(Math.max(sonSaat, 1), 168) * 60 * 60 * 1000
  );

  const satirlar = await prisma.hamMesaj.findMany({
    where: {
      createdAt: { gte: since },
      metin: { contains: q, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, metin: true, createdAt: true },
  });

  return {
    adet: satirlar.length,
    ornekler: satirlar.map((s) => ({
      id: s.id,
      metin: s.metin.slice(0, 200),
      zaman: s.createdAt.toISOString(),
    })),
  };
}

/** OpenAI function: istatistik */
export async function istatistik(gun?: string | null) {
  const g = gun && /^\d{4}-\d{2}-\d{2}$/.test(gun) ? gun : bugunAnahtar();
  const bas = new Date(`${g}T00:00:00+03:00`);
  const [eleme, ham, ilan, bekleyen] = await Promise.all([
    elemeSayaclariOku(g),
    prisma.hamMesaj.count({ where: { createdAt: { gte: bas } } }),
    prisma.yukIlani.count({ where: { createdAt: { gte: bas } } }),
    prisma.hamMesaj.count({ where: { islendi: false } }),
  ]);
  return { gun: g, hamMesaj: ham, ilan, bekleyen, eleme };
}

/** OpenAI function: grupDurumu */
export async function grupDurumu() {
  const [aktif, aday, pasif] = await Promise.all([
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
    }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, durum: "ADAY" },
    }),
    prisma.ilanKaynagi.count({
      where: { tur: TELEGRAM_UYE, durum: "PASIF" },
    }),
  ]);
  const top = await prisma.ilanKaynagi.findMany({
    where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
    orderBy: { bulunanAdet: "desc" },
    take: 5,
    select: { ad: true, bulunanAdet: true, sonTarama: true },
  });
  return { aktif, aday, pasif, enCokIs: top };
}

/** OpenAI function: ilanDetay */
export async function ilanDetay(id: number): Promise<KartIlan | null> {
  const i = await prisma.yukIlani.findUnique({
    where: { id },
    include: { kaynak: { select: { ad: true } } },
  });
  return i ? kartYap(i) : null;
}

/** OpenAI function: iletisimGecmisi — son aranan/ilgilenilen */
export async function iletisimGecmisi(limit = 5) {
  const n = Math.min(Math.max(limit, 1), 10);
  const satirlar = await prisma.yukIlani.findMany({
    where: { durum: "ILGILENIYOR" },
    orderBy: { createdAt: "desc" },
    take: n,
    select: {
      id: true,
      nereden: true,
      nereye: true,
      telefon: true,
      firmaAdi: true,
      createdAt: true,
    },
  });
  return satirlar;
}

export const BOT_ARAC_TANIMLARI = [
  {
    type: "function" as const,
    name: "ilanAra",
    description:
      "Kayıtlı yük ilanlarını ara. cikisIl/varisIl: il veya ilçe (Ostim, Gerede, Gebze, Hadımköy). Varsayılan son 48 saat.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        cikisIl: { type: ["string", "null"] },
        varisIl: { type: ["string", "null"] },
        aracTipi: { type: ["string", "null"] },
        maxTonaj: { type: ["number", "null"] },
        sonSaat: { type: ["number", "null"] },
        limit: { type: ["number", "null"] },
      },
      required: [
        "cikisIl",
        "varisIl",
        "aracTipi",
        "maxTonaj",
        "sonSaat",
        "limit",
      ],
    },
  },
  {
    type: "function" as const,
    name: "hamMesajAra",
    description: "Ayrıştırılmamış ham Telegram mesajlarında metin ara.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        metin: { type: "string" },
        sonSaat: { type: ["number", "null"] },
      },
      required: ["metin", "sonSaat"],
    },
  },
  {
    type: "function" as const,
    name: "istatistik",
    description: "Bugünkü (veya verilen günün) ilan/ham mesaj sayıları.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { gun: { type: ["string", "null"] } },
      required: ["gun"],
    },
  },
  {
    type: "function" as const,
    name: "grupDurumu",
    description: "Takip edilen Telegram gruplarının durumu.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: "function" as const,
    name: "ilanDetay",
    description: "Tek ilanın detayını id ile getir.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "number" } },
      required: ["id"],
    },
  },
  {
    type: "function" as const,
    name: "iletisimGecmisi",
    description: "Takibe alınan (ilgilenilen) son ilanlar.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { limit: { type: ["number", "null"] } },
      required: ["limit"],
    },
  },
];

export async function araciCalistir(
  ad: string,
  argsJson: string
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }

  switch (ad) {
    case "ilanAra":
      return ilanAra({
        cikisIl: (args.cikisIl as string) || null,
        varisIl: (args.varisIl as string) || null,
        aracTipi: (args.aracTipi as string) || null,
        maxTonaj: args.maxTonaj != null ? Number(args.maxTonaj) : null,
        sonSaat: args.sonSaat != null ? Number(args.sonSaat) : null,
        limit: args.limit != null ? Number(args.limit) : null,
      });
    case "hamMesajAra":
      return hamMesajAra(
        String(args.metin || ""),
        args.sonSaat != null ? Number(args.sonSaat) : 48
      );
    case "istatistik":
      return istatistik((args.gun as string) || null);
    case "grupDurumu":
      return grupDurumu();
    case "ilanDetay":
      return ilanDetay(Number(args.id));
    case "iletisimGecmisi":
      return iletisimGecmisi(
        args.limit != null ? Number(args.limit) : 5
      );
    default:
      return { hata: `Bilinmeyen araç: ${ad}` };
  }
}
