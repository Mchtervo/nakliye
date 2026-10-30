import { prisma } from "@/lib/prisma";

const SEARCH1_URL = "https://api.search1api.com/search";
const SEARCH1_CRAWL_URL = "https://api.search1api.com/crawl";
const ZAMAN_ASIMI_MS = 15000;
const CRAWL_ZAMAN_ASIMI_MS = 30000;
const SAYAC_ANAHTAR = "search1_gunluk_sayac";
const VARSAYILAN_GUNLUK_LIMIT = 20;

export type Search1Sonuc = {
  title: string;
  link: string;
  snippet: string;
  published_date?: string;
};

export function search1Kullanilabilir(): boolean {
  return Boolean(process.env.SEARCH1API_KEY) && process.env.SEARCH1_KAPALI !== "true";
}

function gunlukLimit(): number {
  const n = Number(process.env.SEARCH1_GUNLUK_LIMIT);
  return Number.isFinite(n) && n >= 0 ? n : VARSAYILAN_GUNLUK_LIMIT;
}

function bugunTr(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 402 (ödeme gerekli) görülen gün: arama yapılmaz, bir kez haber verilir. */
const KREDI_BITTI_ANAHTAR = "search1_kredi_bitti";

async function krediBittiIsaretle(): Promise<void> {
  const gun = bugunTr();
  const onceki = await prisma.ayar.findUnique({ where: { anahtar: KREDI_BITTI_ANAHTAR } });
  await prisma.ayar.upsert({
    where: { anahtar: KREDI_BITTI_ANAHTAR },
    update: { deger: gun },
    create: { anahtar: KREDI_BITTI_ANAHTAR, deger: gun },
  });
  if (onceki?.deger === gun) return;
  const { bilgiBildir } = await import("@/lib/bildirim/gonder");
  await bilgiBildir(
    "Arama kredisi bitti",
    "Search1API ödeme istiyor (402). Facebook/Google ilan araması durdu; kredi yüklenince ertesi gün kendiliğinden devam eder.",
    "/ayarlar"
  ).catch(() => null);
}

/** Her arama 1 kredi; günlük limit dolduysa false döner ve sayacı artırmaz. */
async function krediAyir(): Promise<boolean> {
  const gun = bugunTr();
  const kayit = await prisma.ayar.findUnique({ where: { anahtar: SAYAC_ANAHTAR } });
  let adet = 0;
  if (kayit) {
    try {
      const j = JSON.parse(kayit.deger) as { gun?: string; adet?: number };
      if (j.gun === gun) adet = j.adet ?? 0;
    } catch {
      adet = 0;
    }
  }
  if (adet >= gunlukLimit()) return false;
  const deger = JSON.stringify({ gun, adet: adet + 1 });
  await prisma.ayar.upsert({
    where: { anahtar: SAYAC_ANAHTAR },
    update: { deger },
    create: { anahtar: SAYAC_ANAHTAR, deger },
  });
  return true;
}

/**
 * Google üzerinden son 24 saatin sonuçları. `site:facebook.com/groups` gibi
 * operatörler sorguda doğrudan kullanılabilir.
 */
export async function search1Ara(
  sorgu: string,
  secenek: { maxSonuc?: number; zaman?: "day" | "week" } = {}
): Promise<Search1Sonuc[]> {
  if ((await prisma.ayar.findUnique({ where: { anahtar: KREDI_BITTI_ANAHTAR } }))?.deger === bugunTr()) {
    throw new Error("Search1API kredisi bitti (402) — yarın tekrar denenecek.");
  }
  if (!(await krediAyir())) {
    throw new Error(`Search1API günlük limit (${gunlukLimit()}) doldu.`);
  }
  const cevap = await fetch(SEARCH1_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SEARCH1API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: sorgu,
      search_service: "google",
      max_results: Math.max(1, Math.min(secenek.maxSonuc ?? 10, 20)),
      time_range: secenek.zaman ?? "day",
      language: "tr",
    }),
    signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    cache: "no-store",
  });
  if (cevap.status === 402) await krediBittiIsaretle();
  if (!cevap.ok) {
    throw new Error(`Search1API ${cevap.status}`);
  }
  const j = (await cevap.json()) as { results?: Search1Sonuc[] };
  return (j.results ?? []).filter((r) => r.link && r.snippet);
}

const GORULEN_ANAHTAR = "search1_gorulen_linkler";
const GORULEN_SURE_MS = 7 * 24 * 60 * 60 * 1000;
const GORULEN_MAX = 1500;

async function gorulenOku(): Promise<Record<string, number>> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: GORULEN_ANAHTAR } });
  if (!k) return {};
  try {
    return JSON.parse(k.deger) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Daha önce işlenmiş linkleri çıkarır (7 gün hafıza). */
export async function yeniLinkleriSuz<T extends { link: string }>(sonuclar: T[]): Promise<T[]> {
  const gorulen = await gorulenOku();
  return sonuclar.filter((s) => !gorulen[s.link]);
}

/** İşlenen linkleri hafızaya yazar; eskileri ve fazlasını budar. */
export async function linkleriGorulduYap(linkler: string[]): Promise<void> {
  if (linkler.length === 0) return;
  const simdi = Date.now();
  const gorulen = await gorulenOku();
  for (const l of linkler) gorulen[l] = simdi;
  const kalan = Object.entries(gorulen)
    .filter(([, t]) => simdi - t < GORULEN_SURE_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, GORULEN_MAX);
  const deger = JSON.stringify(Object.fromEntries(kalan));
  await prisma.ayar.upsert({
    where: { anahtar: GORULEN_ANAHTAR },
    update: { deger },
    create: { anahtar: GORULEN_ANAHTAR, deger },
  });
}

/**
 * Sayfanın tam metni (1 kredi). Google özeti kesik olduğunda telefon için
 * kullanılır; limit dolduysa veya okuma başarısızsa null.
 */
export async function search1Oku(url: string): Promise<string | null> {
  if (!(await krediAyir())) return null;
  try {
    const cevap = await fetch(SEARCH1_CRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SEARCH1API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(CRAWL_ZAMAN_ASIMI_MS),
      cache: "no-store",
    });
    if (!cevap.ok) return null;
    const j = (await cevap.json()) as { results?: { content?: string } };
    const icerik = j.results?.content;
    if (!icerik) return null;
    // Ön bilgi (meta) bloğunu at, markdown linklerini düz metne çevir
    const govde = icerik.replace(/^---\n[\s\S]*?\n---\n/, "");
    return govde.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").slice(0, 3000);
  } catch {
    return null;
  }
}
