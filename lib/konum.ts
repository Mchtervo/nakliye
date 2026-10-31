/**
 * Aracın şu an bulunduğu (ya da vardığı) il ve gitmek istediği yönler.
 * Konum doluysa: yalnız bu il + 60 km çevresinden ÇIKAN yükler.
 * Yön doluysa: yalnız seçilen illere (+ 60 km çevresi) GİDEN yükler.
 * Yolculuk açılınca → konum = boşaltma ili; "Eve döndüm" → ana üs.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import { yakinIller } from "@/lib/donus";

const ANAHTAR = "arac_konum";
const YON_ANAHTAR = "arac_yon_iller";

/** Kullanıcı bilerek "tüm bölge" seçti (Kaldır). */
const TUM = "TUM";

/**
 * Seçilen konum; seçilmemişse açık yolculuğun varış ili, o da yoksa ana üs.
 * Boş konum her yerden bildirim demekti (Gebze → Niğde, Balıkesir → Muğla).
 * Yalnız "Kaldır" (TUM) tüm bölgeyi açar.
 */
export async function aracKonumu(): Promise<string | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: ANAHTAR } });
  if (k?.deger === TUM) return null;
  const secili = ilBul(k?.deger);
  if (secili) return secili;
  const yolculuk = await prisma.donusTalebi.findFirst({
    where: { aktif: true },
    orderBy: { createdAt: "desc" },
    select: { cikisIl: true },
  });
  if (yolculuk?.cikisIl) return yolculuk.cikisIl;
  const anaUs = await prisma.ayar.findUnique({ where: { anahtar: "ai_ana_us" } });
  return ilBul(anaUs?.deger) ?? "Ankara";
}

/** il → o konum; null → bilerek tüm bölge. */
export async function aracKonumuYaz(il: string | null): Promise<void> {
  const deger = il ? ilBul(il) ?? "" : TUM;
  await prisma.ayar.upsert({
    where: { anahtar: ANAHTAR },
    update: { deger },
    create: { anahtar: ANAHTAR, deger },
  });
}

/** "Ne tarafa yük arıyoruz" — seçilen varış illeri (il adı, tekrarsız). */
export async function aracYonleri(): Promise<string[]> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: YON_ANAHTAR } });
  try {
    const j = JSON.parse(k?.deger || "[]") as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** İlçe/il yazılabilir (Gerede → Bolu); tanınmayan atlanır. Dönüş: kaydedilen iller. */
export async function aracYonleriYaz(yerler: string[]): Promise<string[]> {
  const iller = [...new Set(yerler.map((y) => ilBul(y)).filter((x): x is NonNullable<typeof x> => Boolean(x)))].slice(0, 15);
  const deger = JSON.stringify(iller);
  await prisma.ayar.upsert({
    where: { anahtar: YON_ANAHTAR },
    update: { deger },
    create: { anahtar: YON_ANAHTAR, deger },
  });
  return iller;
}

/** Seçilen yönler + her birinin 60 km çevresi (Bolu → Bolu, Düzce). */
export function yonIlleri(yonler: string[]): string[] {
  return [...new Set(yonler.flatMap((il) => yakinIller(il)))];
}

/**
 * Konumdan (+60 km) çıkan ve seçilen yönlere giden ilanlar.
 * Yön seçiliyken varışı yazmayan ilan gelmez.
 */
export function konumKosulu(
  konum: string | null,
  yonler: string[] = []
): Prisma.YukIlaniWhereInput {
  if (!konum && yonler.length === 0) return {};
  const yon: Prisma.YukIlaniWhereInput =
    yonler.length > 0 ? { varisIl: { in: yonIlleri(yonler) } } : {};
  const cikis: Prisma.YukIlaniWhereInput = konum ? { cikisIl: { in: yakinIller(konum) } } : {};
  // İstisna yok: dönüş eşleşmesi de konumun çevresinden çıkmalı (yoksa
  // Düzce'deyken eski Ankara aramasının ilanları sızıyordu).
  return { AND: [cikis, yon] };
}
