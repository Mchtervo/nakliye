/**
 * Aracın şu an bulunduğu (ya da vardığı) il. Doluysa yük ekranı ve
 * bildirimler yalnız bu il + 60 km çevresinden çıkan yükleri getirir.
 * Yolculuk açılınca → boşaltma ili; "Eve döndüm" → ana üs.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ilBul } from "@/lib/iller";
import { yakinIller } from "@/lib/donus";

const ANAHTAR = "arac_konum";

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

/** Konum çevresinden çıkan ilanlar; açık yolculuğun eşleşmeleri de dahil. */
export function konumKosulu(konum: string | null): Prisma.YukIlaniWhereInput {
  if (!konum) return {};
  return { OR: [{ cikisIl: { in: yakinIller(konum) } }, { donusTalebi: { aktif: true } }] };
}
