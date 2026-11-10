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

/** Sefer / gider formundaki "Hangi tır?" seçenekleri. */
export type AracSecenek = { id: number; etiket: string; aktif: boolean };

export async function aracSecenekleri(): Promise<AracSecenek[]> {
  const araclar = await prisma.arac.findMany({
    orderBy: { id: "asc" },
    select: { id: true, ad: true, plaka: true, sofor: true, aktif: true },
  });
  const aktifId = araclar.find((a) => a.aktif)?.id ?? araclar[0]?.id;
  return araclar.map((a, i) => ({
    id: a.id,
    etiket: [a.plaka || `${a.ad} ${i + 1}`, a.sofor].filter(Boolean).join(" · "),
    aktif: a.id === aktifId,
  }));
}

/**
 * Formda seçilen araç (kullanıcının kendi defterinde varsa); seçilmemişse
 * `yedek` (düzenlemede mevcut araç, yeni kayıtta seçili araç).
 */
export async function formdakiAracId(
  ham: FormDataEntryValue | null,
  yedek: () => Promise<number | null>
): Promise<number | null> {
  const id = Number(typeof ham === "string" ? ham : "");
  if (Number.isInteger(id) && id > 0) {
    const a = await prisma.arac.findUnique({ where: { id }, select: { id: true } });
    if (a) return a.id;
  }
  return yedek();
}

/**
 * Bu aracın sefer/gider koşulu. Araç alanı boş eski kayıtlar ilk araca aittir
 * (çoklu araçtan önce tek araç vardı).
 */
export async function aracKayitKosulu(aracId: number): Promise<Prisma.YukWhereInput> {
  const ilk = await prisma.arac.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  return ilk?.id === aracId ? { OR: [{ aracId }, { aracId: null }] } : { aracId };
}
