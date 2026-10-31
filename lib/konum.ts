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

export async function aracKonumu(): Promise<string | null> {
  const k = await prisma.ayar.findUnique({ where: { anahtar: ANAHTAR } });
  return ilBul(k?.deger) ?? null;
}

export async function aracKonumuYaz(il: string | null): Promise<void> {
  const deger = il ? ilBul(il) ?? "" : "";
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
 * Konumdan çıkan + seçilen yönlere giden ilanlar. Açık yolculuğun
 * eşleşmeleri konumdan bağımsız dahil (yöne uyarsa). Yön seçiliyken varışı
 * yazmayan ilan gelmez.
 */
export function konumKosulu(
  konum: string | null,
  yonler: string[] = []
): Prisma.YukIlaniWhereInput {
  if (!konum && yonler.length === 0) return {};
  const yon: Prisma.YukIlaniWhereInput =
    yonler.length > 0 ? { varisIl: { in: yonIlleri(yonler) } } : {};
  const cikis: Prisma.YukIlaniWhereInput = konum ? { cikisIl: { in: yakinIller(konum) } } : {};
  // Dönüş eşleşmesi konumdan bağımsız gelir ama seçilen yöne yine uymalı
  return { OR: [{ AND: [cikis, yon] }, { AND: [{ donusTalebi: { aktif: true } }, yon] }] };
}
