"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type FirmaSonuc = {
  hata: string | null;
  tamam: boolean;
  /** Aynı adla başka firma varsa: birleştirme önerilir */
  birlestir?: { id: number; ad: string };
};

function metin(f: FormData, ad: string, uz: number): string {
  return String(f.get(ad) || "").trim().replace(/\s+/g, " ").slice(0, uz);
}

function yenile(...idler: number[]) {
  revalidatePath("/");
  revalidatePath("/para");
  revalidatePath("/yukler");
  revalidatePath("/raporlar");
  revalidatePath("/firmalar");
  for (const id of idler) revalidatePath(`/firmalar/${id}`);
}

/** Firma adı, telefon ve vergi no düzenleme. */
export async function firmaGuncelle(_o: FirmaSonuc, f: FormData): Promise<FirmaSonuc> {
  const id = Number(f.get("firmaId"));
  if (!Number.isInteger(id) || id <= 0) return { hata: "Firma bulunamadı.", tamam: false };
  const ad = metin(f, "ad", 120);
  if (!ad) return { hata: "Firma adı boş olamaz.", tamam: false };
  const telefon = metin(f, "telefon", 30) || null;
  const vergiNo = metin(f, "vergiNo", 20) || null;

  const firma = await prisma.firma.findUnique({ where: { id } });
  if (!firma) return { hata: "Firma bulunamadı.", tamam: false };

  // Büyük/küçük harf farkıyla aynı ad da "aynı firma" sayılır
  const adKucuk = ad.toLocaleLowerCase("tr");
  const digerleri = await prisma.firma.findMany({ where: { id: { not: id } }, select: { id: true, ad: true } });
  const ayni = digerleri.find((d) => d.ad.toLocaleLowerCase("tr") === adKucuk);
  if (ayni) {
    return { hata: `"${ayni.ad}" adlı firma zaten var.`, tamam: false, birlestir: ayni };
  }

  await prisma.firma.update({ where: { id }, data: { ad, telefon, vergiNo } });
  yenile(id);
  return { hata: null, tamam: true };
}

/** Bu firmanın seferlerini hedef firmaya taşır ve bu firmayı siler. */
export async function firmaBirlestir(kaynakId: number, hedefId: number): Promise<{ hata: string } | void> {
  if (!Number.isInteger(kaynakId) || !Number.isInteger(hedefId) || kaynakId === hedefId) {
    return { hata: "Geçersiz firma." };
  }
  const [kaynak, hedef] = await Promise.all([
    prisma.firma.findUnique({ where: { id: kaynakId } }),
    prisma.firma.findUnique({ where: { id: hedefId } }),
  ]);
  if (!kaynak || !hedef) return { hata: "Firma bulunamadı." };

  await prisma.$transaction([
    prisma.yuk.updateMany({ where: { firmaId: kaynakId }, data: { firmaId: hedefId } }),
    prisma.firma.update({
      where: { id: hedefId },
      data: { telefon: hedef.telefon || kaynak.telefon, vergiNo: hedef.vergiNo || kaynak.vergiNo },
    }),
    prisma.firma.delete({ where: { id: kaynakId } }),
  ]);
  yenile(kaynakId, hedefId);
  redirect(`/firmalar/${hedefId}`);
}
