"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { tlKurusaCevir, tlYaz } from "@/lib/para";

export type OdemeSonuc = { hata: string | null };

/** Ödemeler değişince seferin ödeme durumunu yeniden hesaplar ve sayfaları tazeler. */
async function durumuYenile(yukId: number) {
  const yuk = await prisma.yuk.findUnique({ where: { id: yukId }, include: { odemeler: { select: { tutar: true } } } });
  if (!yuk) return;
  const odenen = yuk.odemeler.reduce((t, o) => t + o.tutar, 0);
  const odemeDurumu = odenen <= 0 ? "BEKLIYOR" : odenen >= yuk.toplamTutar ? "ODENDI" : "KISMI";
  await prisma.yuk.update({ where: { id: yukId }, data: { odemeDurumu } });
  revalidatePath("/");
  revalidatePath("/yukler");
  revalidatePath("/firmalar");
  revalidatePath(`/firmalar/${yuk.firmaId}`);
  revalidatePath("/raporlar");
}

/** Yanlış girilen tahsilatın tutarını düzeltir (seferin toplamını aşamaz). */
export async function odemeGuncelle(id: number, tutarYazi: string): Promise<OdemeSonuc> {
  if (!Number.isInteger(id) || id <= 0) return { hata: "Ödeme bulunamadı." };
  const tutar = tlKurusaCevir(String(tutarYazi || "").trim());
  if (tutar === null || tutar <= 0) return { hata: "Geçerli bir tutar yaz." };
  const odeme = await prisma.odeme.findUnique({ where: { id }, include: { yuk: { include: { odemeler: { select: { id: true, tutar: true } } } } } });
  if (!odeme) return { hata: "Ödeme bulunamadı." };
  const digerleri = odeme.yuk.odemeler.filter((o) => o.id !== id).reduce((t, o) => t + o.tutar, 0);
  const enCok = odeme.yuk.toplamTutar - digerleri;
  if (tutar > enCok) return { hata: `Bu sefer için en fazla ${tlYaz(enCok)} yazabilirsin.` };
  await prisma.odeme.update({ where: { id }, data: { tutar } });
  await durumuYenile(odeme.yukId);
  return { hata: null };
}

/** Yanlış girilen tahsilatı siler; sefer yeniden alacaklı görünür. */
export async function odemeSil(id: number): Promise<OdemeSonuc> {
  if (!Number.isInteger(id) || id <= 0) return { hata: "Ödeme bulunamadı." };
  const odeme = await prisma.odeme.findUnique({ where: { id }, select: { yukId: true } });
  if (!odeme) return { hata: "Ödeme bulunamadı." };
  await prisma.odeme.delete({ where: { id } });
  await durumuYenile(odeme.yukId);
  return { hata: null };
}
