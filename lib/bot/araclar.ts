import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import { bugunAnahtar, elemeSayaclariOku } from "@/lib/kaynaklar/elemeSayac";
import { TELEGRAM_UYE } from "@/lib/kaynaklar/telegramUye";
import { SUPHE_SINIRI, webKaynakHaricKosulu } from "@/lib/kaynaklar/filtre";
import { AYAR_ANAHTARLARI, aiTercihleriOku, ayarOku } from "@/lib/ayarlar";
import {
  GRUP_CIKIS_GUNLUK_ANAHTAR,
  cikisGunlukOku,
} from "@/lib/kaynaklar/grupTemizlik";
import { bugunHarcamaMikro } from "@/lib/ai/butce";
import { gunlukButceUsd, mikrodolarYaz } from "@/lib/ai/maliyet";
import { tlYaz } from "@/lib/para";
import {
  planAdaylariniGetir,
  seferPlanlariUret,
} from "@/lib/seferPlan";
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

function ayBaslangici(ay?: string | null): { bas: Date; etiket: string } {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  let y = tr.getUTCFullYear();
  let m = tr.getUTCMonth();
  if (ay && /^\d{4}-\d{2}$/.test(ay)) {
    y = Number(ay.slice(0, 4));
    m = Number(ay.slice(5, 7)) - 1;
  }
  const etiket = `${y}-${String(m + 1).padStart(2, "0")}`;
  const basTr = new Date(`${etiket}-01T00:00:00+03:00`);
  return { bas: basTr, etiket };
}

function katilimAdet(ham: string | null, gun: string): number {
  if (!ham) return 0;
  const [g, a] = ham.split(":");
  if (g !== gun) return 0;
  const n = Number(a);
  return Number.isFinite(n) ? n : 0;
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
    AND: [webKaynakHaricKosulu()],
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
): Promise<{
  adet: number;
  ornekler: { id: number; metin: string; zaman: string }[];
}> {
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
  const gun = bugunAnahtar();
  const bas = new Date(`${gun}T00:00:00+03:00`);
  const [aktif, aday, pasif, katilimHam, cikisHam, top, bulunanBugun] =
    await Promise.all([
      prisma.ilanKaynagi.count({
        where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
      }),
      prisma.ilanKaynagi.count({
        where: { tur: TELEGRAM_UYE, durum: "ADAY" },
      }),
      prisma.ilanKaynagi.count({
        where: { tur: TELEGRAM_UYE, durum: "PASIF" },
      }),
      ayarOku(AYAR_ANAHTARLARI.telegramKatilimGunluk),
      prisma.ayar.findUnique({ where: { anahtar: GRUP_CIKIS_GUNLUK_ANAHTAR } }),
      prisma.ilanKaynagi.findMany({
        where: { tur: TELEGRAM_UYE, durum: "AKTIF", aktif: true },
        orderBy: { bulunanAdet: "desc" },
        take: 5,
        select: { ad: true, bulunanAdet: true, sonTarama: true },
      }),
      prisma.ilanKaynagi.count({
        where: {
          tur: TELEGRAM_UYE,
          durum: "ADAY",
          createdAt: { gte: bas },
        },
      }),
    ]);

  const bugunTopHam = await prisma.yukIlani.groupBy({
    by: ["kaynakId"],
    where: { createdAt: { gte: bas }, kaynakId: { not: null } },
    _count: { _all: true },
  });
  const bugunTop = [...bugunTopHam]
    .filter((b) => b.kaynakId != null)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 5);
  const kaynakIds = bugunTop
    .map((b) => b.kaynakId)
    .filter((id): id is number => id != null);
  const kaynakAdlar =
    kaynakIds.length > 0
      ? await prisma.ilanKaynagi.findMany({
          where: { id: { in: kaynakIds } },
          select: { id: true, ad: true },
        })
      : [];
  const adMap = new Map(kaynakAdlar.map((k) => [k.id, k.ad]));
  const { adayHavuzOzeti } = await import("@/lib/kaynaklar/adayHavuz");
  const havuz = await adayHavuzOzeti();

  return {
    aktif,
    aday,
    pasif,
    bugunKatilan: katilimAdet(katilimHam, gun),
    bugunCikilan: cikisGunlukOku(cikisHam?.deger ?? null).adet,
    bugunBulunanAday: bulunanBugun,
    adayHavuz: havuz,
    enCokIsToplam: top,
    bugunEnCokIs: bugunTop.map((b) => ({
      ad: (b.kaynakId && adMap.get(b.kaynakId)) || `#${b.kaynakId}`,
      ilan: b._count._all,
    })),
  };
}

/** OpenAI function: ilanDetay */
export async function ilanDetay(id: number): Promise<KartIlan | null> {
  const i = await prisma.yukIlani.findUnique({
    where: { id },
    include: { kaynak: { select: { ad: true } } },
  });
  return i ? kartYap(i) : null;
}

/** OpenAI function: iletisimGecmisi */
export async function iletisimGecmisi(limit = 5) {
  const n = Math.min(Math.max(limit, 1), 10);
  return prisma.yukIlani.findMany({
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
}

/** Muhasebe özeti — SADECE OKUMA. */
export async function muhasebeOzet(ay?: string | null) {
  const { bas, etiket } = ayBaslangici(ay);
  const sonraki = new Date(bas);
  sonraki.setMonth(sonraki.getMonth() + 1);

  const yukler = await prisma.yuk.findMany({
    where: { tarih: { gte: bas, lt: sonraki } },
    select: {
      id: true,
      toplamTutar: true,
      odemeDurumu: true,
      nereden: true,
      nereye: true,
      firma: { select: { ad: true } },
      odemeler: { select: { tutar: true } },
    },
  });

  let gelir = 0;
  let tahsil = 0;
  let bekleyen = 0;
  const bekleyenListe: {
    firma: string;
    rota: string;
    kalan: string;
    durum: string;
  }[] = [];

  for (const y of yukler) {
    gelir += y.toplamTutar;
    const odenen = y.odemeler.reduce((s, o) => s + o.tutar, 0);
    tahsil += odenen;
    const kalan = Math.max(0, y.toplamTutar - odenen);
    if (y.odemeDurumu !== "ODENDI" && kalan > 0) {
      bekleyen += kalan;
      if (bekleyenListe.length < 8) {
        bekleyenListe.push({
          firma: y.firma.ad,
          rota: `${y.nereden}→${y.nereye}`,
          kalan: tlYaz(kalan),
          durum: y.odemeDurumu,
        });
      }
    }
  }

  const acikYukler = await prisma.yuk.findMany({
    where: { odemeDurumu: { in: ["BEKLIYOR", "KISMI"] } },
    select: {
      toplamTutar: true,
      odemeler: { select: { tutar: true } },
    },
    take: 200,
  });
  let tumBekleyen = 0;
  for (const y of acikYukler) {
    const odenen = y.odemeler.reduce((s, o) => s + o.tutar, 0);
    tumBekleyen += Math.max(0, y.toplamTutar - odenen);
  }

  return {
    ay: etiket,
    seferSayisi: yukler.length,
    gelir: tlYaz(gelir),
    tahsilEdilen: tlYaz(tahsil),
    ayBekleyen: tlYaz(bekleyen),
    tumBekleyenAlacak: tlYaz(tumBekleyen),
    bekleyenListe,
    not: "Salt okuma — kayıt değiştirilmez.",
  };
}

/** AI bugünkü harcama. */
export async function aiHarcama() {
  const mikro = await bugunHarcamaMikro();
  const limit = gunlukButceUsd();
  return {
    bugun: mikrodolarYaz(mikro),
    limitUsd: `$${limit.toFixed(2)}`,
    kalanUsd: `$${Math.max(0, limit - mikro / 1e6).toFixed(2)}`,
    killSwitch:
      process.env.AI_KAPALI === "true" || process.env.AI_KAPALI === "1",
  };
}

/** Sefer planı. */
export async function seferPlanla(nerede: string, gun = 3) {
  const il = ilBul(nerede);
  if (!il) return { hata: `Yer çözülemedi: ${nerede}` };
  const tercih = await aiTercihleriOku();
  const adaylar = await planAdaylariniGetir({
    maxTonaj: tercih.maliyet.tonaj,
  });
  const planlar = seferPlanlariUret(il, gun, adaylar, tercih.maliyet);
  return {
    baslangic: il,
    gun,
    planSayisi: planlar.length,
    planlar: planlar.map((p, i) => ({
      alternatif: i + 1,
      ayak: p.ayaklar.length,
      toplam: tlYaz(p.toplamUcret),
      km: p.toplamKm,
      bosKm: p.bosKm,
      net: tlYaz(Math.max(0, p.netTahmini)),
      rota: p.ayaklar
        .map(
          (a) =>
            `${a.ilan.cikisIl}→${a.ilan.varisIl}` +
            (a.ilan.ucret ? ` (${tlYaz(a.ilan.ucret)})` : "")
        )
        .join(" · "),
      ilanIdler: p.ayaklar.map((a) => a.ilan.id),
    })),
  };
}

/** Firma geçmişi — salt okuma. */
export async function firmaGecmisi(ad: string) {
  const q = ad.trim().slice(0, 60);
  if (q.length < 2) return { hata: "Firma adı çok kısa." };

  const firmalar = await prisma.firma.findMany({
    where: { ad: { contains: q, mode: "insensitive" } },
    take: 5,
    select: {
      id: true,
      ad: true,
      telefon: true,
      yukler: {
        orderBy: { tarih: "desc" },
        take: 5,
        select: {
          tarih: true,
          nereden: true,
          nereye: true,
          toplamTutar: true,
          odemeDurumu: true,
        },
      },
    },
  });

  const tel = q.replace(/\D/g, "").slice(-10);
  const ilanlar = await prisma.yukIlani.findMany({
    where: {
      OR: [
        { firmaAdi: { contains: q, mode: "insensitive" } },
        ...(tel.length >= 7
          ? [{ telefon: { contains: tel } }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      firmaAdi: true,
      telefon: true,
      nereden: true,
      nereye: true,
      durum: true,
      createdAt: true,
    },
  });

  return {
    muhasebeFirmalar: firmalar.map((f) => ({
      ad: f.ad,
      telefon: f.telefon,
      seferSayisi: f.yukler.length,
      sonSeferler: f.yukler.map((y) => ({
        tarih: y.tarih.toISOString().slice(0, 10),
        rota: `${y.nereden}→${y.nereye}`,
        tutar: tlYaz(y.toplamTutar),
        odeme: y.odemeDurumu,
      })),
    })),
    ilanKayitlari: ilanlar.map((i) => ({
      id: i.id,
      firma: i.firmaAdi,
      telefon: i.telefon,
      rota: `${i.nereden || "?"}→${i.nereye || "?"}`,
      durum: i.durum,
      zaman: i.createdAt.toISOString(),
    })),
    calisildiMi: firmalar.some((f) => f.yukler.length > 0),
  };
}

export const BOT_ARAC_TANIMLARI = [
  {
    type: "function" as const,
    name: "ilanAra",
    description:
      "Kayıtlı yük ilanlarını ara. cikisIl/varisIl: il veya ilçe (Ostim, Gerede, Gebze). Varsayılan son 48 saat.",
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
    description:
      "Bugün (veya verilen gün) kaç ilan / ham mesaj geldi, kuyrukta kaç bekliyor.",
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
    description:
      "Kaç grup takipte/aday, bugün kaç gruba katıldık/çıktık, hangi grup en çok iş veriyor.",
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
  {
    type: "function" as const,
    name: "muhasebeOzet",
    description:
      "Muhasebe salt okuma: bu ay (veya YYYY-MM) ne kadar kazandım, bekleyen alacak var mı. Kayıt DEĞİŞTİRMEZ.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        ay: {
          type: ["string", "null"],
          description: "YYYY-MM veya null=bu ay",
        },
      },
      required: ["ay"],
    },
  },
  {
    type: "function" as const,
    name: "aiHarcama",
    description: "AI bugün kaç dolar yaktı, günlük limit ve kalan.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: "function" as const,
    name: "seferPlanla",
    description:
      "Mevcut ilanlardan 2–4 ayaklı tur planı. Örn. Ankara'dan 3 günlük tur.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        nerede: { type: "string", description: "Başlangıç il/ilçe" },
        gun: { type: ["number", "null"], description: "2–7, varsayılan 3" },
      },
      required: ["nerede", "gun"],
    },
  },
  {
    type: "function" as const,
    name: "firmaGecmisi",
    description:
      "Şu firmayla daha önce çalışmış mıyım? Muhasebe seferleri + ilan kayıtları (salt okuma).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { ad: { type: "string" } },
      required: ["ad"],
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
      return iletisimGecmisi(args.limit != null ? Number(args.limit) : 5);
    case "muhasebeOzet":
      return muhasebeOzet((args.ay as string) || null);
    case "aiHarcama":
      return aiHarcama();
    case "seferPlanla":
      return seferPlanla(
        String(args.nerede || ""),
        args.gun != null ? Number(args.gun) : 3
      );
    case "firmaGecmisi":
      return firmaGecmisi(String(args.ad || ""));
    default:
      return { hata: `Bilinmeyen araç: ${ad}` };
  }
}
