import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Seçili araç; hiç seçilmemişse ilk araç (tek araçlı eski kayıtlar).
 * Kayıtlar her zaman o anki kullanıcının kendi defterinden okunur.
 */
export async function aktifArac() {
  return (
    (await prisma.arac.findFirst({ where: { aktif: true }, orderBy: { id: "asc" } })) ??
    (await prisma.arac.findFirst({ orderBy: { id: "asc" } }))
  );
}

/**
 * Bu aracın sefer/gider koşulu. Araç alanı boş eski kayıtlar ilk araca aittir
 * (çoklu araçtan önce tek araç vardı).
 */
export async function aracKayitKosulu(aracId: number): Promise<Prisma.YukWhereInput> {
  const ilk = await prisma.arac.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  return ilk?.id === aracId ? { OR: [{ aracId }, { aracId: null }] } : { aracId };
}
